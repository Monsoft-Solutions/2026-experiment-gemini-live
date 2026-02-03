"""OpenAI Realtime (gpt-realtime) voice provider.

Uses the OpenAI Realtime API GA WebSocket interface to proxy real-time
voice conversations through OpenAI's native audio model.

Requires:
  - OPENAI_API_KEY

Audio format:
  - Input:  16-bit PCM mono @ 16 kHz from browser → resampled to 24 kHz for OpenAI
  - Output: 16-bit PCM mono @ 24 kHz (same as Gemini, no conversion needed)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import struct
from typing import AsyncIterator

import websockets

from providers.base import (
    EventType,
    ProviderConfig,
    ProviderEvent,
    ProviderVoice,
    VoiceProvider,
    VoiceSession,
)

logger = logging.getLogger(__name__)

OPENAI_WS_URL = "wss://api.openai.com/v1/realtime"
OPENAI_MODEL = "gpt-realtime"

# ---------------------------------------------------------------------------
# Voices
# ---------------------------------------------------------------------------

OPENAI_VOICES = [
    ProviderVoice(id="marin", name="Marin", style="Warm, recommended"),
    ProviderVoice(id="cedar", name="Cedar", style="Warm, recommended"),
    ProviderVoice(id="alloy", name="Alloy", style="Neutral"),
    ProviderVoice(id="ash", name="Ash", style="Conversational"),
    ProviderVoice(id="ballad", name="Ballad", style="Expressive"),
    ProviderVoice(id="coral", name="Coral", style="Friendly"),
    ProviderVoice(id="echo", name="Echo", style="Smooth"),
    ProviderVoice(id="sage", name="Sage", style="Authoritative"),
    ProviderVoice(id="shimmer", name="Shimmer", style="Bright"),
    ProviderVoice(id="verse", name="Verse", style="Versatile"),
]

# ---------------------------------------------------------------------------
# Audio resampling helpers
# ---------------------------------------------------------------------------


def _resample_pcm16(data: bytes, from_rate: int, to_rate: int) -> bytes:
    """Resample 16-bit PCM mono audio via linear interpolation."""
    if from_rate == to_rate:
        return data

    # Unpack int16 samples
    n_samples = len(data) // 2
    if n_samples == 0:
        return data
    samples = struct.unpack(f"<{n_samples}h", data)

    ratio = from_rate / to_rate
    out_len = int(n_samples / ratio)
    out = []
    for i in range(out_len):
        src_idx = i * ratio
        idx = int(src_idx)
        frac = src_idx - idx
        if idx + 1 < n_samples:
            val = samples[idx] * (1 - frac) + samples[idx + 1] * frac
        else:
            val = samples[idx] if idx < n_samples else 0
        out.append(int(max(-32768, min(32767, val))))

    return struct.pack(f"<{len(out)}h", *out)


# ---------------------------------------------------------------------------
# Tool format conversion
# ---------------------------------------------------------------------------


def _gemini_type_to_json_schema(t: str) -> str:
    """Convert Gemini-style type names to JSON Schema types."""
    mapping = {
        "STRING": "string",
        "NUMBER": "number",
        "INTEGER": "integer",
        "BOOLEAN": "boolean",
        "OBJECT": "object",
        "ARRAY": "array",
    }
    return mapping.get(t.upper(), t.lower())


def _convert_properties(props: dict) -> dict:
    """Recursively convert Gemini-style property defs to JSON Schema."""
    out = {}
    for key, val in props.items():
        converted = {}
        if "type" in val:
            converted["type"] = _gemini_type_to_json_schema(val["type"])
        if "description" in val:
            converted["description"] = val["description"]
        if "properties" in val:
            converted["properties"] = _convert_properties(val["properties"])
        if "items" in val:
            converted["items"] = _convert_properties({"_": val["items"]})["_"]
        if "required" in val:
            converted["required"] = val["required"]
        if "enum" in val:
            converted["enum"] = val["enum"]
        out[key] = converted
    return out


def _gemini_tools_to_openai(tools: list[dict]) -> list[dict]:
    """Convert our Gemini-format tool declarations to OpenAI function format."""
    openai_tools = []
    for tool in tools:
        params = tool.get("parameters", {})
        converted_params: dict = {
            "type": _gemini_type_to_json_schema(params.get("type", "OBJECT")),
        }
        if "properties" in params:
            converted_params["properties"] = _convert_properties(params["properties"])
        if "required" in params:
            converted_params["required"] = params["required"]

        openai_tools.append({
            "type": "function",
            "name": tool["name"],
            "description": tool.get("description", ""),
            "parameters": converted_params,
        })
    return openai_tools


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class OpenAIRealtimeSession(VoiceSession):
    """Wraps a single OpenAI Realtime API WebSocket session."""

    def __init__(self, ws, config: ProviderConfig):
        self._ws = ws
        self._config = config
        self._closed = False
        # Track current function call being accumulated
        self._current_fc_name: str | None = None
        self._current_fc_args: str = ""
        self._current_fc_call_id: str | None = None
        self._current_fc_item_id: str | None = None
        # Track whether we're in a response (for interruption detection)
        self._in_response = False

    async def send_audio(self, chunk: bytes) -> None:
        """Send PCM audio (16kHz from browser) → resample to 24kHz → base64 → OpenAI."""
        if self._closed:
            return
        # Resample 16kHz → 24kHz
        resampled = _resample_pcm16(chunk, 16000, 24000)
        encoded = base64.b64encode(resampled).decode("ascii")
        await self._ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": encoded,
        }))

    async def send_text(self, text: str) -> None:
        """Send a text message as a conversation item, then trigger a response."""
        if self._closed:
            return
        # Create user text message
        await self._ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": text}],
            },
        }))
        # Trigger a response
        await self._ws.send(json.dumps({"type": "response.create"}))

    async def send_image(self, data: bytes, mime_type: str = "image/jpeg") -> None:
        """Send an image as a conversation item for vision."""
        if self._closed:
            return
        fmt = mime_type.split("/")[-1] if "/" in mime_type else "jpeg"
        encoded = base64.b64encode(data).decode("ascii")
        await self._ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": "user",
                "content": [{
                    "type": "input_image",
                    "image_url": f"data:{mime_type};base64,{encoded}",
                }],
            },
        }))

    async def send_tool_result(self, tool_id: str, name: str, result: str) -> None:
        """Send function call output back to OpenAI, then trigger continuation."""
        if self._closed:
            return
        # Create function_call_output item
        await self._ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "function_call_output",
                "call_id": tool_id,
                "output": result,
            },
        }))
        # Trigger the model to continue responding
        await self._ws.send(json.dumps({"type": "response.create"}))

    async def receive(self) -> AsyncIterator[ProviderEvent]:
        """Yield ProviderEvents from the OpenAI Realtime WebSocket."""
        try:
            async for raw in self._ws:
                try:
                    msg = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue

                event_type = msg.get("type", "")

                # --- Session lifecycle (log only) ---
                if event_type in ("session.created", "session.updated"):
                    logger.info(f"OpenAI: {event_type}")
                    continue

                # --- Audio output delta ---
                if event_type == "response.output_audio.delta":
                    audio_b64 = msg.get("delta", "")
                    if audio_b64:
                        audio_bytes = base64.b64decode(audio_b64)
                        yield ProviderEvent(
                            type=EventType.AUDIO,
                            data=audio_bytes,
                        )
                    continue

                # --- Agent audio transcript delta ---
                if event_type == "response.output_audio_transcript.delta":
                    delta = msg.get("delta", "")
                    if delta:
                        yield ProviderEvent(
                            type=EventType.TRANSCRIPT_AGENT,
                            text=delta,
                        )
                    continue

                # --- User input audio transcription completed ---
                if event_type == "conversation.item.input_audio_transcription.completed":
                    transcript = msg.get("transcript", "").strip()
                    if transcript:
                        yield ProviderEvent(
                            type=EventType.TRANSCRIPT_USER,
                            text=transcript,
                        )
                    continue

                # --- User input audio transcription delta ---
                if event_type == "conversation.item.input_audio_transcription.delta":
                    # Could stream user transcript deltas, but we'll use
                    # the completed event for simplicity
                    continue

                # --- Function call arguments accumulation ---
                if event_type == "response.function_call_arguments.delta":
                    delta = msg.get("delta", "")
                    self._current_fc_args += delta
                    continue

                # --- Function call complete ---
                if event_type == "response.function_call_arguments.done":
                    # Parse accumulated args
                    args_str = msg.get("arguments", self._current_fc_args)
                    call_id = msg.get("call_id", self._current_fc_call_id)
                    name = msg.get("name", self._current_fc_name)
                    try:
                        args = json.loads(args_str) if args_str else {}
                    except json.JSONDecodeError:
                        args = {}
                    yield ProviderEvent(
                        type=EventType.TOOL_CALL,
                        tool_name=name,
                        tool_args=args,
                        tool_id=call_id,
                    )
                    # Reset
                    self._current_fc_name = None
                    self._current_fc_args = ""
                    self._current_fc_call_id = None
                    self._current_fc_item_id = None
                    continue

                # --- Response output item added (track function call metadata) ---
                if event_type == "response.output_item.added":
                    item = msg.get("item", {})
                    if item.get("type") == "function_call":
                        self._current_fc_name = item.get("name")
                        self._current_fc_call_id = item.get("call_id")
                        self._current_fc_item_id = item.get("id")
                        self._current_fc_args = ""
                    continue

                # --- Response lifecycle ---
                if event_type == "response.created":
                    self._in_response = True
                    continue

                if event_type == "response.done":
                    self._in_response = False
                    # Check if response was cancelled (interruption)
                    resp = msg.get("response", {})
                    status = resp.get("status", "")
                    if status == "cancelled":
                        yield ProviderEvent(type=EventType.INTERRUPTED)
                    else:
                        yield ProviderEvent(type=EventType.TURN_COMPLETE)
                    continue

                # --- Speech detection (interruption signal) ---
                if event_type == "input_audio_buffer.speech_started":
                    if self._in_response:
                        yield ProviderEvent(type=EventType.INTERRUPTED)
                    continue

                if event_type == "input_audio_buffer.speech_stopped":
                    continue

                # --- Errors ---
                if event_type == "error":
                    error = msg.get("error", {})
                    error_msg = error.get("message", str(error))
                    logger.error(f"OpenAI Realtime error: {error_msg}")
                    yield ProviderEvent(
                        type=EventType.ERROR,
                        text=error_msg,
                    )
                    continue

                # --- Rate limits (log only) ---
                if event_type == "rate_limits.updated":
                    continue

                # --- All other events (log at debug level) ---
                logger.debug(f"OpenAI unhandled event: {event_type}")

        except websockets.exceptions.ConnectionClosed as e:
            logger.info(f"OpenAI WebSocket closed: {e}")
        except Exception as e:
            logger.error(f"OpenAI receive error: {e}")
            yield ProviderEvent(type=EventType.ERROR, text=str(e))

    async def close(self) -> None:
        """Close the WebSocket connection."""
        self._closed = True
        try:
            await self._ws.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------


class OpenAIRealtimeProvider(VoiceProvider):
    """OpenAI Realtime API (gpt-realtime) provider."""

    name = "openai"
    display_name = "OpenAI Realtime"

    # OpenAI outputs 24kHz 16-bit PCM mono (same as Gemini)
    output_sample_rate = 24000

    def __init__(self):
        self._api_key = os.getenv("OPENAI_API_KEY", "")
        self._model = os.getenv("OPENAI_REALTIME_MODEL", OPENAI_MODEL)

    async def get_voices(self) -> list[ProviderVoice]:
        return list(OPENAI_VOICES)

    async def connect(self, config: ProviderConfig) -> OpenAIRealtimeSession:
        """Open an OpenAI Realtime WebSocket session."""
        url = f"{OPENAI_WS_URL}?model={self._model}"

        ws = await websockets.connect(
            url,
            additional_headers={
                "Authorization": f"Bearer {self._api_key}",
            },
        )

        # Wait for session.created
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            first_msg = json.loads(raw)
            if first_msg.get("type") == "session.created":
                logger.info(
                    f"OpenAI session created: {first_msg.get('session', {}).get('id', 'unknown')}"
                )
            else:
                logger.warning(f"OpenAI unexpected first message: {first_msg.get('type')}")
        except asyncio.TimeoutError:
            logger.warning("OpenAI: no session.created within 10s")
        except websockets.exceptions.ConnectionClosed as e:
            logger.error(f"OpenAI connection closed during init: {e}")
            raise

        # Send session.update to configure the session
        session_config = self._build_session_config(config)
        await ws.send(json.dumps({
            "type": "session.update",
            "session": session_config,
        }))

        # Wait for session.updated confirmation
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            update_msg = json.loads(raw)
            if update_msg.get("type") == "session.updated":
                logger.info("OpenAI session configured successfully")
            elif update_msg.get("type") == "error":
                error = update_msg.get("error", {})
                logger.error(f"OpenAI session config error: {error.get('message', error)}")
            else:
                logger.warning(f"OpenAI unexpected post-update message: {update_msg.get('type')}")
        except asyncio.TimeoutError:
            logger.warning("OpenAI: no session.updated within 10s")

        session = OpenAIRealtimeSession(ws, config)
        logger.info(
            f"OpenAI Realtime session opened (model={self._model}, "
            f"voice={config.voice}, lang={config.language})"
        )
        return session

    def _build_session_config(self, config: ProviderConfig) -> dict:
        """Build the OpenAI Realtime session.update payload."""
        # Convert tools from Gemini format to OpenAI format
        tools = []
        if config.tools:
            tools = _gemini_tools_to_openai(config.tools)

        session: dict = {
            "type": "realtime",
            "model": self._model,
            "output_modalities": ["audio"],
            "audio": {
                "input": {
                    "format": {
                        "type": "audio/pcm",
                        "rate": 24000,
                    },
                    "transcription": {
                        "model": "gpt-4o-transcribe",
                    },
                    "turn_detection": {
                        "type": "semantic_vad",
                    },
                },
                "output": {
                    "format": {
                        "type": "audio/pcm",
                        "rate": 24000,
                    },
                    "voice": config.voice or "marin",
                },
            },
            "tools": tools,
            "tool_choice": "auto",
        }

        if config.system_prompt:
            session["instructions"] = config.system_prompt

        return session
