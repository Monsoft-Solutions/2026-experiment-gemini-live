"""Twilio webhook endpoints and phone number management API.

Routes:
  POST /twilio/voice          — Incoming call webhook (returns TwiML)
  POST /twilio/status         — Call status callback
  POST /twilio/recording      — Recording status callback
  WS   /twilio/media-stream   — Media Stream WebSocket (audio bridge)
  GET  /twilio/numbers        — List account phone numbers
  POST /twilio/numbers/link   — Link a number to a persona
  POST /twilio/numbers/unlink — Unlink a number
  GET  /twilio/calls          — Call history
  GET  /twilio/calls/{id}     — Call detail with transcript
"""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, JSONResponse

from convex_client import get_convex
from providers import get_provider
from providers.base import ProviderConfig
from twilio_integration.bridge import TwilioAudioBridge

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twilio", tags=["twilio"])

# Cache Twilio credentials (refreshed from Convex on each call)
_twilio_config_cache: dict | None = None


async def _get_twilio_config() -> dict | None:
    """Fetch Twilio config from Convex adminSettings."""
    try:
        convex = get_convex()
        config = await convex.query("adminSettings:get", {"key": "twilio"})
        return config
    except Exception as e:
        logger.error(f"Failed to fetch Twilio config: {e}")
        return None


async def _get_twilio_client():
    """Get httpx-based Twilio REST client credentials."""
    config = await _get_twilio_config()
    if not config:
        return None, None
    return config.get("twilioAccountSid"), config.get("twilioAuthToken")


# ---------- Incoming Call Webhook ----------

@router.post("/voice")
async def twilio_voice(request: Request):
    """Handle incoming Twilio call — return TwiML to connect Media Stream."""
    form = await request.form()
    to_number = form.get("To", "")
    from_number = form.get("From", "")
    call_sid = form.get("CallSid", "")

    logger.info(f"Incoming call: {from_number} → {to_number} (CallSid={call_sid})")

    # Look up phone number → persona
    convex = get_convex()
    phone_config = await convex.query(
        "phoneNumbers:getByNumber", {"phoneNumber": to_number}
    )

    if not phone_config or not phone_config.get("isActive"):
        logger.warning(f"No active config for number {to_number}")
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say>Sorry, this number is not configured. Goodbye.</Say>
            <Hangup/>
        </Response>"""
        return Response(content=twiml, media_type="application/xml")

    persona = phone_config.get("persona")
    if not persona:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say>Sorry, the agent for this number is unavailable. Goodbye.</Say>
            <Hangup/>
        </Response>"""
        return Response(content=twiml, media_type="application/xml")

    persona_id = phone_config.get("personaId")
    phone_number_id = phone_config.get("_id")
    provider_name = persona.get("provider", "gemini")

    # Create call record in Convex
    try:
        await convex.mutation("calls:create", {
            "phoneNumberId": phone_number_id,
            "personaId": persona_id,
            "twilioCallSid": call_sid,
            "from": from_number,
            "to": to_number,
            "status": "in-progress",
            "direction": "inbound",
            "provider": provider_name,
            "personaName": persona.get("name"),
            "settings": {
                "voice": persona.get("voice", ""),
                "language": persona.get("language", "en-US"),
                "systemPrompt": persona.get("systemPrompt", ""),
            },
        })
    except Exception as e:
        logger.error(f"Failed to create call record: {e}")

    # Build TwiML — connect Media Stream to our WebSocket
    twilio_config = await _get_twilio_config()
    base_url = twilio_config.get("twilioWebhookBaseUrl", "") if twilio_config else ""
    ws_url = base_url.replace("https://", "wss://").replace("http://", "ws://")
    stream_url = f"{ws_url}/twilio/media-stream"

    # Pass metadata as stream parameters
    params = {
        "callSid": call_sid,
        "personaId": persona_id,
        "provider": provider_name,
    }

    # Enable recording
    status_callback = f"{base_url}/twilio/recording"

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Start>
            <Stream url="{stream_url}">
                {"".join(f'<Parameter name="{k}" value="{v}" />' for k, v in params.items())}
            </Stream>
        </Start>
        <Record
            recordingStatusCallback="{status_callback}"
            recordingStatusCallbackEvent="completed"
            recordingStatusCallbackMethod="POST"
            maxLength="3600"
            trim="trim-silence"
        />
        <Pause length="3600"/>
    </Response>"""

    return Response(content=twiml, media_type="application/xml")


# ---------- Media Stream WebSocket ----------

@router.websocket("/media-stream")
async def twilio_media_stream(ws: WebSocket):
    """Handle Twilio Media Stream WebSocket — bridge to voice provider."""
    await ws.accept()
    logger.info("Twilio Media Stream connected")

    import json

    # Wait for the connected event to get custom parameters
    try:
        raw = await ws.receive_text()
        first_msg = json.loads(raw)
    except Exception as e:
        logger.error(f"Failed to receive first message: {e}")
        return

    if first_msg.get("event") != "connected":
        logger.warning(f"Expected 'connected', got: {first_msg.get('event')}")

    # Wait for start event with stream metadata
    try:
        raw = await ws.receive_text()
        start_msg = json.loads(raw)
    except Exception as e:
        logger.error(f"Failed to receive start message: {e}")
        return

    if start_msg.get("event") != "start":
        logger.warning(f"Expected 'start', got: {start_msg.get('event')}")
        return

    start_data = start_msg.get("start", {})
    custom_params = start_data.get("customParameters", {})
    call_sid = custom_params.get("callSid", "unknown")
    persona_id = custom_params.get("personaId", "")
    provider_name = custom_params.get("provider", "gemini")
    stream_sid = start_data.get("streamSid", "")

    logger.info(
        f"Media stream started: stream={stream_sid} call={call_sid} "
        f"persona={persona_id} provider={provider_name}"
    )

    # Fetch persona config from Convex
    convex = get_convex()
    persona = None
    if persona_id:
        try:
            persona = await convex.query("personas:get", {"id": persona_id})
        except Exception as e:
            logger.error(f"Failed to fetch persona: {e}")

    if not persona:
        logger.error(f"Persona not found: {persona_id}")
        await ws.close()
        return

    # Get provider
    try:
        provider = get_provider(provider_name)
    except KeyError as e:
        logger.error(f"Provider not found: {e}")
        await ws.close()
        return

    # Build provider config
    from server import TOOL_DECLARATIONS

    config = ProviderConfig(
        voice=persona.get("voice", "Aoede"),
        language=persona.get("language", "en-US"),
        system_prompt=persona.get("systemPrompt", ""),
        tools=TOOL_DECLARATIONS,
        affective_dialog=persona.get("affectiveDialog", False),
        proactive_audio=persona.get("proactiveAudio", False),
        google_search=persona.get("googleSearch", False),
    )

    # Find call record ID for transcript storage
    call_record = await convex.query("calls:getByCallSid", {"callSid": call_sid})
    call_id = call_record.get("_id") if call_record else None

    # Transcript callback
    async def on_transcript(role: str, text: str):
        if call_id:
            try:
                await convex.mutation("calls:addMessage", {
                    "callId": call_id,
                    "role": role,
                    "text": text,
                })
            except Exception as e:
                logger.error(f"Failed to save transcript: {e}")

    # Call end callback
    async def on_call_end():
        logger.info(f"Call ended: {call_sid}")

    # Create and run the bridge
    bridge = TwilioAudioBridge(
        twilio_ws=ws,
        provider=provider,
        config=config,
        call_sid=call_sid,
        on_transcript=on_transcript,
        on_call_end=on_call_end,
    )

    # Inject the stream_sid so the bridge doesn't need to wait for start again
    bridge.stream_sid = stream_sid

    await bridge.run()
    logger.info(f"Media stream ended: {call_sid}")


# ---------- Call Status Callback ----------

@router.post("/status")
async def twilio_status(request: Request):
    """Handle Twilio call status callback — update call record."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    status = form.get("CallStatus", "")
    duration = form.get("CallDuration", "")

    logger.info(f"Call status: {call_sid} → {status} (duration={duration}s)")

    convex = get_convex()
    try:
        import time
        updates = {
            "callSid": call_sid,
            "status": status,
            "endedAt": int(time.time() * 1000),
        }
        if duration:
            updates["duration"] = int(duration)
        await convex.mutation("calls:updateByCallSid", updates)
    except Exception as e:
        logger.error(f"Failed to update call status: {e}")

    return Response(status_code=204)


# ---------- Recording Status Callback ----------

@router.post("/recording")
async def twilio_recording(request: Request):
    """Handle Twilio recording status — download and transcribe."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    recording_sid = form.get("RecordingSid", "")
    recording_url = form.get("RecordingUrl", "")
    recording_status = form.get("RecordingStatus", "")

    logger.info(
        f"Recording status: {call_sid} → {recording_status} "
        f"(sid={recording_sid})"
    )

    if recording_status != "completed":
        return Response(status_code=204)

    # Update call record with recording info
    convex = get_convex()
    try:
        await convex.mutation("calls:updateByCallSid", {
            "callSid": call_sid,
            "recordingSid": recording_sid,
            "recordingUrl": recording_url,
        })
    except Exception as e:
        logger.error(f"Failed to update recording info: {e}")

    # Trigger async transcription
    asyncio.create_task(_transcribe_recording(call_sid, recording_sid, recording_url))

    return Response(status_code=204)


async def _transcribe_recording(call_sid: str, recording_sid: str, recording_url: str):
    """Download recording from Twilio and transcribe it."""
    try:
        account_sid, auth_token = await _get_twilio_client()
        if not account_sid or not auth_token:
            logger.error("Twilio credentials not configured, skipping transcription")
            return

        # Download recording as WAV
        wav_url = f"{recording_url}.wav"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                wav_url,
                auth=(account_sid, auth_token),
                follow_redirects=True,
                timeout=60.0,
            )
            if resp.status_code != 200:
                logger.error(f"Failed to download recording: {resp.status_code}")
                return
            audio_data = resp.content

        logger.info(f"Downloaded recording: {len(audio_data)} bytes")

        # Transcribe using OpenAI Whisper if available
        import os
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            transcript = await _transcribe_with_whisper(audio_data, openai_key)
        else:
            logger.info("No OPENAI_API_KEY for transcription, skipping")
            return

        if transcript:
            convex = get_convex()
            await convex.mutation("calls:updateByCallSid", {
                "callSid": call_sid,
                "transcript": transcript,
            })
            logger.info(f"Transcription saved for call {call_sid}")

    except Exception as e:
        logger.error(f"Transcription error for {call_sid}: {e}")


async def _transcribe_with_whisper(audio_data: bytes, api_key: str) -> str | None:
    """Transcribe audio using OpenAI Whisper API."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": ("recording.wav", audio_data, "audio/wav")},
                data={"model": "whisper-1"},
                timeout=120.0,
            )
            if resp.status_code != 200:
                logger.error(f"Whisper API error: {resp.status_code} {resp.text}")
                return None
            return resp.json().get("text", "")
    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        return None


# ---------- Phone Number Management ----------

@router.get("/numbers")
async def list_numbers():
    """List all Twilio phone numbers from the account."""
    account_sid, auth_token = await _get_twilio_client()
    if not account_sid or not auth_token:
        return JSONResponse(
            {"error": "Twilio credentials not configured"},
            status_code=400,
        )

    # Fetch numbers from Twilio API
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}"
                f"/IncomingPhoneNumbers.json",
                auth=(account_sid, auth_token),
                timeout=10.0,
            )
            if resp.status_code != 200:
                return JSONResponse(
                    {"error": f"Twilio API error: {resp.status_code}"},
                    status_code=500,
                )
            twilio_numbers = resp.json().get("incoming_phone_numbers", [])
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

    # Get our linked numbers from Convex
    convex = get_convex()
    linked = await convex.query("phoneNumbers:list") or []
    linked_map = {n["phoneNumber"]: n for n in linked}

    # Merge
    result = []
    for tn in twilio_numbers:
        phone = tn.get("phone_number", "")
        linked_info = linked_map.get(phone)
        result.append({
            "phoneNumber": phone,
            "twilioSid": tn.get("sid", ""),
            "friendlyName": tn.get("friendly_name", ""),
            "linked": linked_info is not None,
            "personaId": linked_info.get("personaId") if linked_info else None,
            "personaName": linked_info.get("personaName") if linked_info else None,
            "isActive": linked_info.get("isActive", False) if linked_info else False,
            "linkId": linked_info.get("_id") if linked_info else None,
        })

    return result


@router.post("/numbers/link")
async def link_number(request: Request):
    """Link a Twilio phone number to a persona."""
    data = await request.json()
    phone_number = data.get("phoneNumber")
    twilio_sid = data.get("twilioSid")
    persona_id = data.get("personaId")
    friendly_name = data.get("friendlyName", "")

    if not phone_number or not twilio_sid or not persona_id:
        return JSONResponse(
            {"error": "phoneNumber, twilioSid, and personaId required"},
            status_code=400,
        )

    # Update Twilio number webhooks
    twilio_config = await _get_twilio_config()
    if not twilio_config:
        return JSONResponse(
            {"error": "Twilio not configured"},
            status_code=400,
        )

    account_sid = twilio_config.get("twilioAccountSid")
    auth_token = twilio_config.get("twilioAuthToken")
    base_url = twilio_config.get("twilioWebhookBaseUrl", "")

    voice_url = f"{base_url}/twilio/voice"
    status_url = f"{base_url}/twilio/status"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}"
                f"/IncomingPhoneNumbers/{twilio_sid}.json",
                auth=(account_sid, auth_token),
                data={
                    "VoiceUrl": voice_url,
                    "VoiceMethod": "POST",
                    "StatusCallback": status_url,
                    "StatusCallbackMethod": "POST",
                },
                timeout=10.0,
            )
            if resp.status_code != 200:
                return JSONResponse(
                    {"error": f"Failed to update Twilio number: {resp.text}"},
                    status_code=500,
                )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

    # Save to Convex
    convex = get_convex()

    # Check if already linked
    existing = await convex.query(
        "phoneNumbers:getByNumber", {"phoneNumber": phone_number}
    )
    if existing:
        await convex.mutation("phoneNumbers:update", {
            "id": existing["_id"],
            "personaId": persona_id,
            "friendlyName": friendly_name,
            "isActive": True,
        })
    else:
        await convex.mutation("phoneNumbers:create", {
            "phoneNumber": phone_number,
            "twilioSid": twilio_sid,
            "personaId": persona_id,
            "friendlyName": friendly_name,
        })

    return {"status": "linked"}


@router.post("/numbers/unlink")
async def unlink_number(request: Request):
    """Unlink a phone number from its persona."""
    data = await request.json()
    link_id = data.get("linkId")

    if not link_id:
        return JSONResponse({"error": "linkId required"}, status_code=400)

    convex = get_convex()
    await convex.mutation("phoneNumbers:remove", {"id": link_id})

    return {"status": "unlinked"}


# ---------- Call History API ----------

@router.get("/calls")
async def list_calls(limit: int = 50):
    """List recent calls."""
    convex = get_convex()
    calls = await convex.query("calls:list", {"limit": limit})
    return calls or []


@router.get("/calls/{call_id}")
async def get_call(call_id: str):
    """Get call detail with messages."""
    convex = get_convex()
    call = await convex.query("calls:get", {"id": call_id})
    if not call:
        return JSONResponse({"error": "Call not found"}, status_code=404)
    messages = await convex.query("calls:getMessages", {"callId": call_id})
    return {"call": call, "messages": messages or []}


# ---------- Admin Settings ----------

@router.get("/config")
async def get_twilio_config_endpoint():
    """Get current Twilio configuration (masks auth token)."""
    config = await _get_twilio_config()
    if not config:
        return {"configured": False}

    return {
        "configured": bool(config.get("twilioAccountSid")),
        "accountSid": config.get("twilioAccountSid", ""),
        "authToken": "••••" + (config.get("twilioAuthToken", "")[-4:])
            if config.get("twilioAuthToken") else "",
        "webhookBaseUrl": config.get("twilioWebhookBaseUrl", ""),
    }


@router.post("/config")
async def save_twilio_config(request: Request):
    """Save Twilio configuration."""
    data = await request.json()
    convex = get_convex()
    await convex.mutation("adminSettings:upsert", {
        "key": "twilio",
        "twilioAccountSid": data.get("accountSid", ""),
        "twilioAuthToken": data.get("authToken", ""),
        "twilioWebhookBaseUrl": data.get("webhookBaseUrl", ""),
    })
    return {"status": "saved"}
