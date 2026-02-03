"""Abstract base classes for real-time voice conversation providers.

Every provider (Gemini, OpenAI, ElevenLabs, ...) must implement
VoiceProvider and VoiceSession so the FastAPI WebSocket handler
stays provider-agnostic.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class ProviderVoice:
    """A voice option offered by a provider."""

    id: str  # Provider-specific voice identifier (e.g. "Aoede", "alloy")
    name: str  # Human-readable display name
    style: str  # Short description (e.g. "Warm", "Bright")
    language: str = "multilingual"  # Primary language or "multilingual"


@dataclass
class ProviderConfig:
    """Configuration sent by the frontend when opening a session."""

    voice: str  # Voice id (provider-specific)
    language: str = "en-US"
    system_prompt: str = ""
    tools: list[dict] | None = None  # Common tool declarations
    affective_dialog: bool = False
    proactive_audio: bool = False
    google_search: bool = False
    # Pass-through bucket for provider-specific options
    extra: dict = field(default_factory=dict)


class EventType(str, Enum):
    """Types of events a provider session can emit."""

    AUDIO = "audio"  # Raw audio bytes for playback
    TRANSCRIPT_USER = "transcript_user"  # User speech transcript chunk
    TRANSCRIPT_AGENT = "transcript_agent"  # Agent speech transcript chunk
    TOOL_CALL = "tool_call"  # Provider wants a tool executed
    TOOL_RESULT = "tool_result"  # Result being sent back (informational)
    TURN_COMPLETE = "turn_complete"  # Agent finished its turn
    INTERRUPTED = "interrupted"  # User interrupted the agent
    ERROR = "error"  # Recoverable error from the provider


@dataclass
class ProviderEvent:
    """A single event yielded by a provider session.

    Depending on ``type``, different fields are populated:

    * AUDIO            → ``data`` (raw PCM bytes, provider's native rate)
    * TRANSCRIPT_USER  → ``text``
    * TRANSCRIPT_AGENT → ``text``
    * TOOL_CALL        → ``tool_name``, ``tool_args``, ``tool_id``
    * TURN_COMPLETE    → (no extra fields)
    * INTERRUPTED      → (no extra fields)
    * ERROR            → ``text`` (error message)
    """

    type: EventType
    data: bytes | None = None
    text: str | None = None
    tool_name: str | None = None
    tool_args: dict | None = None
    tool_id: str | None = None


# ---------------------------------------------------------------------------
# Abstract interfaces
# ---------------------------------------------------------------------------


class VoiceSession(ABC):
    """An active real-time voice conversation session with a provider.

    Returned by ``VoiceProvider.connect()``.  The WebSocket handler
    drives the session through send_*/receive and finally close().
    """

    @abstractmethod
    async def send_audio(self, chunk: bytes) -> None:
        """Send a raw PCM audio chunk (16-bit, 16 kHz mono) to the provider.

        The provider implementation is responsible for any resampling
        needed (e.g. 16 kHz → 24 kHz for OpenAI).
        """

    @abstractmethod
    async def send_text(self, text: str) -> None:
        """Send a text message to the provider."""

    @abstractmethod
    async def send_image(self, data: bytes, mime_type: str = "image/jpeg") -> None:
        """Send an image frame (e.g. screen-share) to the provider.

        Providers that don't support vision should log a warning and
        silently ignore the call.
        """

    @abstractmethod
    async def send_tool_result(self, tool_id: str, name: str, result: str) -> None:
        """Send a function/tool execution result back to the provider."""

    @abstractmethod
    async def receive(self) -> AsyncIterator[ProviderEvent]:
        """Yield events from the provider.

        This is an async generator that runs for the lifetime of the
        session.  It yields ``ProviderEvent`` objects.  The caller
        (WebSocket handler) decides what to forward to the browser.
        """

    @abstractmethod
    async def close(self) -> None:
        """Cleanly shut down the session and release resources."""


class VoiceProvider(ABC):
    """Factory for voice sessions.

    One instance per provider lives in the registry for the lifetime
    of the server process.
    """

    # Subclasses must set these as class attributes or in __init__
    name: str  # Short key: "gemini", "openai", "elevenlabs"
    display_name: str  # UI label: "Gemini Live", "OpenAI Realtime"

    @abstractmethod
    async def get_voices(self) -> list[ProviderVoice]:
        """Return the list of available voices for this provider."""

    @abstractmethod
    async def connect(self, config: ProviderConfig) -> VoiceSession:
        """Create and return a new real-time voice session."""

    def to_dict(self, voices: list[ProviderVoice] | None = None) -> dict:
        """Serialize provider info for the /config endpoint."""
        voice_list = voices or []
        d = {
            "name": self.name,
            "displayName": self.display_name,
            "voices": [
                {"id": v.id, "name": v.name, "style": v.style, "language": v.language}
                for v in voice_list
            ],
        }
        # Include output sample rate if the provider declares one
        if hasattr(self, "output_sample_rate"):
            d["outputSampleRate"] = self.output_sample_rate
        return d
