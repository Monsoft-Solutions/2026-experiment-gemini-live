"""Voice provider registry.

Providers auto-register based on available environment variables.
Usage:
    from providers import get_provider, get_all_providers

    provider = get_provider("gemini")
    all_providers = get_all_providers()
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from providers.base import VoiceProvider

logger = logging.getLogger(__name__)

_registry: dict[str, VoiceProvider] = {}


def register_provider(provider: VoiceProvider) -> None:
    """Register a provider instance."""
    _registry[provider.name] = provider
    logger.info(f"Registered provider: {provider.name} ({provider.display_name})")


def get_provider(name: str) -> VoiceProvider:
    """Get a provider by name. Raises KeyError if not found."""
    if name not in _registry:
        available = ", ".join(_registry.keys()) or "(none)"
        raise KeyError(f"Unknown provider '{name}'. Available: {available}")
    return _registry[name]


def get_all_providers() -> dict[str, VoiceProvider]:
    """Return all registered providers."""
    return dict(_registry)


def init_providers() -> None:
    """Auto-register providers based on available environment/config."""

    # Gemini (Vertex AI)
    if os.getenv("PROJECT_ID"):
        try:
            from providers.gemini import GeminiProvider

            register_provider(GeminiProvider())
        except Exception as e:
            logger.warning(f"Failed to init Gemini provider: {e}")
    else:
        logger.info("Skipping Gemini provider (PROJECT_ID not set)")

    # OpenAI Realtime
    if os.getenv("OPENAI_API_KEY"):
        try:
            from providers.openai_rt import OpenAIRealtimeProvider

            register_provider(OpenAIRealtimeProvider())
        except Exception as e:
            logger.warning(f"Failed to init OpenAI Realtime provider: {e}")
    else:
        logger.info("Skipping OpenAI Realtime provider (OPENAI_API_KEY not set)")

    # ElevenLabs Conversational AI
    if os.getenv("ELEVENLABS_API_KEY") and os.getenv("ELEVENLABS_AGENT_ID"):
        try:
            from providers.elevenlabs import ElevenLabsProvider

            register_provider(ElevenLabsProvider())
        except Exception as e:
            logger.warning(f"Failed to init ElevenLabs provider: {e}")
    else:
        logger.info("Skipping ElevenLabs provider (ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID not set)")

    if not _registry:
        logger.warning("No voice providers registered! Check environment variables.")
