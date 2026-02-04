"""Twilio Media Stream ↔ Voice Provider audio bridge.

Handles bidirectional audio streaming between a Twilio phone call
and one of our voice providers (Gemini, OpenAI, ElevenLabs).

Twilio Media Stream protocol:
  - Incoming: JSON messages with base64-encoded mulaw 8kHz audio
  - Outgoing: JSON messages with base64-encoded mulaw 8kHz audio
  - Control: start, stop, mark, clear events
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import TYPE_CHECKING

from twilio_integration.audio import provider_to_twilio_audio, twilio_to_provider_audio

if TYPE_CHECKING:
    from fastapi import WebSocket as FastAPIWebSocket

    from providers.base import ProviderConfig, ProviderEvent, VoiceProvider

from providers.base import EventType

logger = logging.getLogger(__name__)


class TwilioAudioBridge:
    """Bridges a Twilio Media Stream WebSocket to a voice provider session.

    Lifecycle:
      1. Twilio connects to our WebSocket endpoint
      2. We receive the `start` event with stream metadata
      3. We open a session with the configured provider
      4. Audio flows bidirectionally until `stop` or disconnect
    """

    def __init__(
        self,
        twilio_ws: FastAPIWebSocket,
        provider: VoiceProvider,
        config: ProviderConfig,
        call_sid: str,
        on_transcript: callable | None = None,
        on_call_end: callable | None = None,
    ):
        self.twilio_ws = twilio_ws
        self.provider = provider
        self.config = config
        self.call_sid = call_sid
        self.on_transcript = on_transcript  # async callback(role, text)
        self.on_call_end = on_call_end  # async callback()

        self.stream_sid: str | None = None
        self.session = None
        self._closed = False
        self._provider_rate = getattr(provider, "output_sample_rate", 24000)

        # Transcript accumulation
        self._current_caller_text = ""
        self._current_agent_text = ""

    async def run(self):
        """Main loop — handle Twilio Media Stream and provider events."""
        try:
            # Open provider session
            if hasattr(self.provider, "connect_ctx"):
                async with self.provider.connect_ctx(self.config) as session:
                    self.session = session
                    await self._run_bridge()
            else:
                self.session = await self.provider.connect(self.config)
                try:
                    await self._run_bridge()
                finally:
                    await self.session.close()
        except Exception as e:
            logger.error(f"Bridge error for call {self.call_sid}: {e}")
        finally:
            self._closed = True
            if self.on_call_end:
                try:
                    await self.on_call_end()
                except Exception as e:
                    logger.error(f"on_call_end error: {e}")

    async def _run_bridge(self):
        """Run bidirectional audio bridge tasks."""
        tasks = [
            asyncio.create_task(self._recv_from_twilio()),
            asyncio.create_task(self._recv_from_provider()),
        ]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for t in pending:
            t.cancel()

    async def _recv_from_twilio(self):
        """Receive audio from Twilio Media Stream and forward to provider."""
        try:
            while not self._closed:
                raw = await self.twilio_ws.receive_text()
                msg = json.loads(raw)
                event = msg.get("event")

                if event == "start":
                    self.stream_sid = msg.get("start", {}).get("streamSid")
                    logger.info(
                        f"Twilio stream started: {self.stream_sid} "
                        f"(call={self.call_sid})"
                    )

                elif event == "media":
                    payload = msg.get("media", {}).get("payload", "")
                    if payload and self.session:
                        mulaw_bytes = base64.b64decode(payload)
                        # Convert mulaw 8kHz → PCM 16kHz for provider
                        pcm_data = twilio_to_provider_audio(mulaw_bytes, 16000)
                        await self.session.send_audio(pcm_data)

                elif event == "stop":
                    logger.info(f"Twilio stream stopped (call={self.call_sid})")
                    break

                elif event == "mark":
                    # Mark reached — playback tracking (unused for now)
                    pass

        except Exception as e:
            if not self._closed:
                logger.error(f"Twilio recv error: {e}")

    async def _recv_from_provider(self):
        """Receive events from provider and forward audio to Twilio."""
        if not self.session:
            return

        try:
            async for event in self.session.receive():
                if self._closed:
                    break

                if event.type == EventType.AUDIO:
                    await self._send_audio_to_twilio(event.data)

                elif event.type == EventType.TRANSCRIPT_USER:
                    self._current_caller_text += event.text or ""

                elif event.type == EventType.TRANSCRIPT_AGENT:
                    self._current_agent_text += event.text or ""

                elif event.type == EventType.TOOL_CALL:
                    # Execute tool and send result back
                    logger.info(f"Tool call in phone call: {event.tool_name}")
                    from server import execute_tool
                    result = execute_tool(event.tool_name, event.tool_args or {})
                    await self.session.send_tool_result(
                        tool_id=event.tool_id,
                        name=event.tool_name,
                        result=result,
                    )

                elif event.type == EventType.TURN_COMPLETE:
                    # Save accumulated transcripts
                    await self._flush_transcripts()

                elif event.type == EventType.INTERRUPTED:
                    # Clear Twilio's audio buffer on interruption
                    await self._clear_twilio_audio()
                    await self._flush_transcripts()

                elif event.type == EventType.ERROR:
                    logger.error(f"Provider error in call: {event.text}")

        except Exception as e:
            if not self._closed:
                logger.error(f"Provider recv error: {e}")

    async def _send_audio_to_twilio(self, pcm_data: bytes):
        """Convert provider PCM → mulaw and send to Twilio stream."""
        if not self.stream_sid or self._closed:
            return

        mulaw_data = provider_to_twilio_audio(pcm_data, self._provider_rate)
        encoded = base64.b64encode(mulaw_data).decode("ascii")

        try:
            await self.twilio_ws.send_text(json.dumps({
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {"payload": encoded},
            }))
        except Exception as e:
            logger.debug(f"Failed to send audio to Twilio: {e}")

    async def _clear_twilio_audio(self):
        """Send clear event to stop Twilio audio playback (interruption)."""
        if not self.stream_sid or self._closed:
            return

        try:
            await self.twilio_ws.send_text(json.dumps({
                "event": "clear",
                "streamSid": self.stream_sid,
            }))
        except Exception:
            pass

    async def _flush_transcripts(self):
        """Save accumulated transcripts via callback and reset."""
        if self.on_transcript:
            if self._current_caller_text.strip():
                try:
                    await self.on_transcript("caller", self._current_caller_text.strip())
                except Exception as e:
                    logger.error(f"Transcript save error: {e}")
            if self._current_agent_text.strip():
                try:
                    await self.on_transcript("agent", self._current_agent_text.strip())
                except Exception as e:
                    logger.error(f"Transcript save error: {e}")
        self._current_caller_text = ""
        self._current_agent_text = ""
