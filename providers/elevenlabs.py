"""ElevenLabs Conversational AI voice provider.

Uses the ElevenLabs Conversational AI WebSocket API to proxy
real-time voice conversations through an ElevenLabs agent.

Requires:
  - ELEVENLABS_API_KEY  (API key for auth + voice listing)
  - ELEVENLABS_AGENT_ID (pre-configured agent on ElevenLabs)

Audio format:
  - Input:  16-bit PCM mono @ 16 kHz (same as browser sends)
  - Output: 16-bit PCM mono @ 16 kHz (vs Gemini's 24 kHz)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from typing import AsyncIterator

import httpx
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

ELEVENLABS_API_BASE = "https://api.elevenlabs.io"
ELEVENLABS_WS_BASE = "wss://api.elevenlabs.io"


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class ElevenLabsSession(VoiceSession):
    """Wraps a single ElevenLabs Conversational AI WebSocket session."""

    def __init__(self, ws, config: ProviderConfig, conversation_id: str | None = None):
        self._ws = ws
        self._config = config
        self._conversation_id = conversation_id
        self._last_interrupt_id = 0
        self._closed = False

    async def send_audio(self, chunk: bytes) -> None:
        """Send PCM audio chunk as base64-encoded user_audio_chunk."""
        if self._closed:
            return
        encoded = base64.b64encode(chunk).decode("ascii")
        await self._ws.send(json.dumps({"user_audio_chunk": encoded}))

    async def send_text(self, text: str) -> None:
        """Send a text message to the agent."""
        if self._closed:
            return
        await self._ws.send(
            json.dumps({"type": "user_message", "text": text})
        )

    async def send_image(self, data: bytes, mime_type: str = "image/jpeg") -> None:
        """ElevenLabs ConvAI doesn't support vision — silently ignore."""
        logger.debug("ElevenLabs: send_image ignored (not supported)")

    async def send_tool_result(self, tool_id: str, name: str, result: str) -> None:
        """Send a client tool result back to ElevenLabs."""
        if self._closed:
            return
        await self._ws.send(
            json.dumps(
                {
                    "type": "client_tool_result",
                    "tool_call_id": tool_id,
                    "result": result,
                    "is_error": False,
                }
            )
        )

    async def receive(self) -> AsyncIterator[ProviderEvent]:
        """Yield ProviderEvents translated from ElevenLabs WebSocket messages."""
        try:
            async for raw in self._ws:
                try:
                    msg = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue

                msg_type = msg.get("type", "")

                # --- Conversation metadata ---
                if msg_type == "conversation_initiation_metadata":
                    event = msg.get("conversation_initiation_metadata_event", {})
                    self._conversation_id = event.get("conversation_id")
                    logger.info(
                        f"ElevenLabs conversation started: {self._conversation_id}"
                    )
                    continue

                # --- Audio data ---
                if msg_type == "audio":
                    event = msg.get("audio_event", {})
                    event_id = int(event.get("event_id", 0))
                    if event_id <= self._last_interrupt_id:
                        continue  # Stale audio after interruption
                    audio_b64 = event.get("audio_base_64", "")
                    if audio_b64:
                        audio_bytes = base64.b64decode(audio_b64)
                        yield ProviderEvent(
                            type=EventType.AUDIO, data=audio_bytes
                        )
                    continue

                # --- User transcript ---
                if msg_type == "user_transcript":
                    event = msg.get("user_transcription_event", {})
                    text = event.get("user_transcript", "").strip()
                    if text:
                        yield ProviderEvent(
                            type=EventType.TRANSCRIPT_USER, text=text
                        )
                    continue

                # --- Agent response (text) ---
                if msg_type == "agent_response":
                    event = msg.get("agent_response_event", {})
                    text = event.get("agent_response", "").strip()
                    if text:
                        yield ProviderEvent(
                            type=EventType.TRANSCRIPT_AGENT, text=text
                        )
                        # ElevenLabs agent_response is a complete turn
                        yield ProviderEvent(type=EventType.TURN_COMPLETE)
                    continue

                # --- Agent response correction ---
                if msg_type == "agent_response_correction":
                    event = msg.get("agent_response_correction_event", {})
                    text = event.get("corrected_agent_response", "").strip()
                    if text:
                        yield ProviderEvent(
                            type=EventType.TRANSCRIPT_AGENT, text=f"[corrected] {text}"
                        )
                    continue

                # --- Interruption ---
                if msg_type == "interruption":
                    event = msg.get("interruption_event", {})
                    self._last_interrupt_id = int(event.get("event_id", 0))
                    yield ProviderEvent(type=EventType.INTERRUPTED)
                    continue

                # --- Ping / keepalive ---
                if msg_type == "ping":
                    event = msg.get("ping_event", {})
                    event_id = event.get("event_id")
                    ping_ms = event.get("ping_ms", 0)
                    # Schedule pong after the requested delay
                    asyncio.create_task(self._send_pong(event_id, ping_ms))
                    continue

                # --- Client tool call ---
                if msg_type == "client_tool_call":
                    tool_call = msg.get("client_tool_call", {})
                    yield ProviderEvent(
                        type=EventType.TOOL_CALL,
                        tool_name=tool_call.get("tool_name"),
                        tool_args=tool_call.get("parameters", {}),
                        tool_id=tool_call.get("tool_call_id"),
                    )
                    continue

                # --- Turn complete (ElevenLabs signals this via agent response end) ---
                # ElevenLabs doesn't have an explicit turn_complete like Gemini.
                # We'll emit TURN_COMPLETE when we get an agent_response since
                # their responses are complete (not streaming chunks).
                # This is handled above — agent_response is a full turn.

        except websockets.exceptions.ConnectionClosed:
            logger.info("ElevenLabs WebSocket closed")
        except Exception as e:
            logger.error(f"ElevenLabs receive error: {e}")
            yield ProviderEvent(type=EventType.ERROR, text=str(e))

    async def _send_pong(self, event_id: str, ping_ms: int) -> None:
        """Send pong response after the requested delay."""
        try:
            if ping_ms > 0:
                await asyncio.sleep(ping_ms / 1000.0)
            if not self._closed:
                await self._ws.send(
                    json.dumps({"type": "pong", "event_id": event_id})
                )
        except Exception:
            pass

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


class ElevenLabsProvider(VoiceProvider):
    """ElevenLabs Conversational AI provider."""

    name = "elevenlabs"
    display_name = "ElevenLabs"

    # Output audio is 16kHz 16-bit PCM mono
    output_sample_rate = 16000

    def __init__(self):
        self._api_key = os.getenv("ELEVENLABS_API_KEY", "")
        self._agent_id = os.getenv("ELEVENLABS_AGENT_ID", "")
        self._voices_cache: list[ProviderVoice] | None = None

    async def get_voices(self) -> list[ProviderVoice]:
        """Fetch available voices from the ElevenLabs API."""
        if self._voices_cache is not None:
            return self._voices_cache

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{ELEVENLABS_API_BASE}/v1/voices",
                    headers={"xi-api-key": self._api_key},
                    timeout=10.0,
                )
                resp.raise_for_status()
                data = resp.json()

            voices = []
            for v in data.get("voices", []):
                labels = v.get("labels", {})
                style = labels.get("description", labels.get("accent", ""))
                if not style and v.get("description"):
                    style = v["description"][:40]
                voices.append(
                    ProviderVoice(
                        id=v["voice_id"],
                        name=v.get("name", v["voice_id"]),
                        style=style or "Custom",
                        language=labels.get("language", "multilingual"),
                    )
                )

            self._voices_cache = voices
            logger.info(f"ElevenLabs: loaded {len(voices)} voices")
            return voices

        except Exception as e:
            logger.error(f"Failed to fetch ElevenLabs voices: {e}")
            # Return a minimal fallback so the provider still works
            return [
                ProviderVoice(
                    id="21m00Tcm4TlvDq8ikWAM",
                    name="Rachel",
                    style="Calm",
                    language="en",
                ),
                ProviderVoice(
                    id="EXAVITQu4vr4xnSDxMaL",
                    name="Sarah",
                    style="Soft",
                    language="en",
                ),
            ]

    async def connect(self, config: ProviderConfig) -> ElevenLabsSession:
        """Open an ElevenLabs Conversational AI WebSocket session."""
        # Build WebSocket URL
        ws_url = (
            f"{ELEVENLABS_WS_BASE}/v1/convai/conversation"
            f"?agent_id={self._agent_id}"
        )

        # Connect with API key auth
        ws = await websockets.connect(
            ws_url,
            additional_headers={"xi-api-key": self._api_key},
        )

        # Send conversation initiation with config overrides
        initiation = {
            "type": "conversation_initiation_client_data",
            "conversation_config_override": {
                "agent": {
                    "language": config.language[:2],  # ElevenLabs uses ISO 639-1
                },
                "tts": {
                    "voice_id": config.voice,
                },
            },
        }

        # Override system prompt if provided
        if config.system_prompt:
            initiation["conversation_config_override"]["agent"]["prompt"] = {
                "prompt": config.system_prompt,
            }

        await ws.send(json.dumps(initiation))

        session = ElevenLabsSession(ws, config)
        logger.info(
            f"ElevenLabs session opened (agent={self._agent_id}, "
            f"voice={config.voice}, lang={config.language})"
        )
        return session
