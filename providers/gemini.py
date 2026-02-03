"""Gemini Live (Vertex AI) voice provider.

Wraps the google-genai SDK's live.connect() into the abstract
VoiceProvider / VoiceSession interface.
"""

from __future__ import annotations

import logging
import os
from typing import AsyncIterator

from google import genai
from google.genai import types

from providers.base import (
    EventType,
    ProviderConfig,
    ProviderEvent,
    ProviderVoice,
    VoiceProvider,
    VoiceSession,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Voices (Gemini Live native audio)
# ---------------------------------------------------------------------------

GEMINI_VOICES = [
    ProviderVoice(id="Zephyr", name="Zephyr", style="Bright"),
    ProviderVoice(id="Kore", name="Kore", style="Firm"),
    ProviderVoice(id="Orus", name="Orus", style="Firm"),
    ProviderVoice(id="Autonoe", name="Autonoe", style="Bright"),
    ProviderVoice(id="Umbriel", name="Umbriel", style="Easy-going"),
    ProviderVoice(id="Erinome", name="Erinome", style="Clear"),
    ProviderVoice(id="Laomedeia", name="Laomedeia", style="Upbeat"),
    ProviderVoice(id="Schedar", name="Schedar", style="Even"),
    ProviderVoice(id="Achird", name="Achird", style="Friendly"),
    ProviderVoice(id="Sadachbia", name="Sadachbia", style="Lively"),
    ProviderVoice(id="Puck", name="Puck", style="Upbeat"),
    ProviderVoice(id="Fenrir", name="Fenrir", style="Excitable"),
    ProviderVoice(id="Aoede", name="Aoede", style="Breezy"),
    ProviderVoice(id="Enceladus", name="Enceladus", style="Breathy"),
    ProviderVoice(id="Algieba", name="Algieba", style="Smooth"),
    ProviderVoice(id="Algenib", name="Algenib", style="Gravelly"),
    ProviderVoice(id="Achernar", name="Achernar", style="Soft"),
    ProviderVoice(id="Gacrux", name="Gacrux", style="Mature"),
    ProviderVoice(id="Zubenelgenubi", name="Zubenelgenubi", style="Casual"),
    ProviderVoice(id="Sadaltager", name="Sadaltager", style="Knowledgeable"),
    ProviderVoice(id="Charon", name="Charon", style="Informative"),
    ProviderVoice(id="Leda", name="Leda", style="Youthful"),
    ProviderVoice(id="Callirrhoe", name="Callirrhoe", style="Easy-going"),
    ProviderVoice(id="Iapetus", name="Iapetus", style="Clear"),
    ProviderVoice(id="Despina", name="Despina", style="Smooth"),
    ProviderVoice(id="Rasalgethi", name="Rasalgethi", style="Informative"),
    ProviderVoice(id="Alnilam", name="Alnilam", style="Firm"),
    ProviderVoice(id="Pulcherrima", name="Pulcherrima", style="Forward"),
    ProviderVoice(id="Vindemiatrix", name="Vindemiatrix", style="Gentle"),
    ProviderVoice(id="Sulafat", name="Sulafat", style="Warm"),
]

# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class GeminiSession(VoiceSession):
    """Wraps a single ``client.aio.live.connect()`` session."""

    def __init__(self, session, config: ProviderConfig):
        self._session = session
        self._config = config

    async def send_audio(self, chunk: bytes) -> None:
        await self._session.send_realtime_input(
            audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
        )

    async def send_text(self, text: str) -> None:
        await self._session.send(input=text, end_of_turn=True)

    async def send_image(self, data: bytes, mime_type: str = "image/jpeg") -> None:
        await self._session.send_realtime_input(
            video=types.Blob(data=data, mime_type=mime_type)
        )

    async def send_tool_result(self, tool_id: str, name: str, result: str) -> None:
        await self._session.send_tool_response(
            function_responses=[
                types.FunctionResponse(
                    name=name,
                    id=tool_id,
                    response={"result": result},
                )
            ]
        )

    async def receive(self) -> AsyncIterator[ProviderEvent]:
        """Yield ProviderEvents translated from Gemini server responses."""
        while True:
            async for resp in self._session.receive():
                sc = resp.server_content
                tool_call = resp.tool_call

                # --- Tool calls ---
                if tool_call:
                    for fc in tool_call.function_calls:
                        yield ProviderEvent(
                            type=EventType.TOOL_CALL,
                            tool_name=fc.name,
                            tool_args=fc.args or {},
                            tool_id=fc.id,
                        )
                    continue

                if not sc:
                    continue

                # --- Audio data ---
                if sc.model_turn:
                    for part in sc.model_turn.parts:
                        if part.inline_data:
                            yield ProviderEvent(
                                type=EventType.AUDIO,
                                data=part.inline_data.data,
                            )

                # --- Transcriptions ---
                if sc.input_transcription and sc.input_transcription.text:
                    yield ProviderEvent(
                        type=EventType.TRANSCRIPT_USER,
                        text=sc.input_transcription.text,
                    )

                if sc.output_transcription and sc.output_transcription.text:
                    yield ProviderEvent(
                        type=EventType.TRANSCRIPT_AGENT,
                        text=sc.output_transcription.text,
                    )

                # --- Turn signals ---
                if sc.turn_complete:
                    yield ProviderEvent(type=EventType.TURN_COMPLETE)

                if sc.interrupted:
                    yield ProviderEvent(type=EventType.INTERRUPTED)

    async def close(self) -> None:
        # The session is managed via async-with in GeminiProvider.connect(),
        # so closing is handled there.  This is a no-op safety valve.
        pass


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------


class GeminiProvider(VoiceProvider):
    """Gemini Live via Vertex AI."""

    name = "gemini"
    display_name = "Gemini Live"

    # Gemini outputs 24kHz 16-bit PCM mono
    output_sample_rate = 24000

    def __init__(self):
        self._project_id = os.getenv("PROJECT_ID")
        self._location = os.getenv("LOCATION", "us-central1")
        self._model = os.getenv(
            "MODEL", "gemini-live-2.5-flash-preview-native-audio-09-2025"
        )

    @property
    def model(self) -> str:
        return self._model

    async def get_voices(self) -> list[ProviderVoice]:
        return list(GEMINI_VOICES)

    async def connect(self, config: ProviderConfig) -> GeminiSession:
        """Open a Gemini Live session and return a GeminiSession wrapper.

        IMPORTANT: The caller is responsible for using this inside an
        ``async with`` on the underlying live connection.  Because
        ``client.aio.live.connect()`` is an async context manager we
        expose a helper ``connect_ctx()`` that the WebSocket handler
        should use instead.
        """
        # This is a convenience — callers should use connect_ctx().
        raise RuntimeError(
            "Use GeminiProvider.connect_ctx() instead — see docstring."
        )

    def connect_ctx(self, config: ProviderConfig):
        """Return an async context manager that yields a GeminiSession.

        Usage in the WebSocket handler::

            async with provider.connect_ctx(config) as session:
                ...
        """
        return _GeminiSessionContext(self, config)


class _GeminiSessionContext:
    """Async context manager wrapping client.aio.live.connect()."""

    def __init__(self, provider: GeminiProvider, config: ProviderConfig):
        self._provider = provider
        self._config = config
        self._cm = None  # The live-connect context manager

    def _build_live_config(self) -> types.LiveConnectConfig:
        """Translate ProviderConfig → Gemini LiveConnectConfig."""
        config = self._config

        # Tools
        tools_list: list[dict] = []
        if config.tools:
            tools_list.append({"function_declarations": config.tools})
        if config.google_search:
            tools_list.append({"google_search": {}})

        kwargs: dict = {
            "response_modalities": [types.Modality.AUDIO],
            "speech_config": types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=config.voice
                    )
                ),
                language_code=config.language,
            ),
            "input_audio_transcription": types.AudioTranscriptionConfig(),
            "output_audio_transcription": types.AudioTranscriptionConfig(),
            "tools": tools_list,
        }

        if config.system_prompt:
            kwargs["system_instruction"] = types.Content(
                parts=[types.Part(text=config.system_prompt)]
            )

        if config.affective_dialog:
            kwargs["enable_affective_dialog"] = True

        if config.proactive_audio:
            kwargs["proactivity"] = types.ProactivityConfig(proactive_audio=True)

        return types.LiveConnectConfig(**kwargs)

    async def __aenter__(self) -> GeminiSession:
        client = genai.Client(
            vertexai=True,
            project=self._provider._project_id,
            location=self._provider._location,
        )
        live_config = self._build_live_config()
        self._cm = client.aio.live.connect(
            model=self._provider._model,
            config=live_config,
        )
        session = await self._cm.__aenter__()
        return GeminiSession(session, self._config)

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._cm:
            return await self._cm.__aexit__(exc_type, exc_val, exc_tb)
        return False
