import asyncio
import base64
import json
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION", "us-central1")
MODEL = os.getenv("MODEL", "gemini-live-2.5-flash-preview-native-audio-09-2025")

app = FastAPI()
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def root():
    return FileResponse("frontend/index.html")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("Client connected")

    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

    audio_queue = asyncio.Queue()
    text_queue = asyncio.Queue()

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    async with client.aio.live.connect(model=MODEL, config=config) as session:

        async def recv_from_browser():
            try:
                while True:
                    msg = await ws.receive()
                    if msg.get("bytes"):
                        await audio_queue.put(msg["bytes"])
                    elif msg.get("text"):
                        await text_queue.put(msg["text"])
            except WebSocketDisconnect:
                logger.info("Client disconnected")
            except Exception as e:
                logger.error(f"recv error: {e}")

        async def send_audio():
            try:
                while True:
                    chunk = await audio_queue.get()
                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=chunk, mime_type="audio/pcm;rate=16000"
                        )
                    )
            except asyncio.CancelledError:
                pass

        async def send_text():
            try:
                while True:
                    text = await text_queue.get()
                    await session.send(input=text, end_of_turn=True)
            except asyncio.CancelledError:
                pass

        async def recv_from_gemini():
            try:
                while True:
                    async for resp in session.receive():
                        sc = resp.server_content
                        if not sc:
                            continue

                        if sc.model_turn:
                            for part in sc.model_turn.parts:
                                if part.inline_data:
                                    await ws.send_bytes(part.inline_data.data)

                        if sc.input_transcription and sc.input_transcription.text:
                            await ws.send_json(
                                {"type": "user", "text": sc.input_transcription.text}
                            )

                        if sc.output_transcription and sc.output_transcription.text:
                            await ws.send_json(
                                {"type": "gemini", "text": sc.output_transcription.text}
                            )

                        if sc.turn_complete:
                            await ws.send_json({"type": "turn_complete"})

                        if sc.interrupted:
                            await ws.send_json({"type": "interrupted"})

            except Exception as e:
                logger.error(f"gemini recv error: {e}")

        tasks = [
            asyncio.create_task(recv_from_browser()),
            asyncio.create_task(send_audio()),
            asyncio.create_task(send_text()),
            asyncio.create_task(recv_from_gemini()),
        ]

        # Wait until browser disconnects (first task to finish)
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for t in pending:
            t.cancel()

    try:
        await ws.close()
    except Exception:
        pass

    logger.info("Session ended")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "5173"))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        ssl_keyfile="certs/key.pem",
        ssl_certfile="certs/cert.pem",
    )
