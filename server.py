import asyncio
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

# ---------- Built-in function calling tools ----------

TOOL_DECLARATIONS = [
    {
        "name": "get_current_time",
        "description": "Get the current date and time in a given timezone.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "timezone": {
                    "type": "STRING",
                    "description": "IANA timezone, e.g. America/New_York. Defaults to UTC.",
                }
            },
        },
    },
    {
        "name": "get_weather",
        "description": "Get current weather for a city or location.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "location": {
                    "type": "STRING",
                    "description": "City name or location, e.g. 'Miami, FL'",
                }
            },
            "required": ["location"],
        },
    },
    {
        "name": "calculate",
        "description": "Evaluate a math expression and return the result.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "expression": {
                    "type": "STRING",
                    "description": "Math expression to evaluate, e.g. '2 * 3 + 5'",
                }
            },
            "required": ["expression"],
        },
    },
]


def execute_tool(name: str, args: dict) -> str:
    """Execute a built-in tool and return the result as a string."""
    try:
        if name == "get_current_time":
            from datetime import datetime, timezone
            import zoneinfo

            tz_name = args.get("timezone", "UTC")
            try:
                tz = zoneinfo.ZoneInfo(tz_name)
            except Exception:
                tz = timezone.utc
            now = datetime.now(tz)
            return now.strftime("%A, %B %d, %Y at %I:%M %p %Z")

        elif name == "get_weather":
            import urllib.request

            location = args.get("location", "")
            url = f"https://wttr.in/{location.replace(' ', '+')}?format=j1"
            req = urllib.request.Request(url, headers={"User-Agent": "curl/8.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read())
            current = data.get("current_condition", [{}])[0]
            desc = current.get("weatherDesc", [{}])[0].get("value", "Unknown")
            temp_f = current.get("temp_F", "?")
            temp_c = current.get("temp_C", "?")
            humidity = current.get("humidity", "?")
            wind = current.get("windspeedMiles", "?")
            return f"{desc}, {temp_f}°F ({temp_c}°C), humidity {humidity}%, wind {wind} mph"

        elif name == "calculate":
            expression = args.get("expression", "")
            # Safe eval with only math operations
            allowed = set("0123456789+-*/().% ")
            if all(c in allowed for c in expression):
                result = eval(expression)  # noqa: S307
                return str(result)
            else:
                return "Error: expression contains invalid characters"

        return f"Unknown tool: {name}"
    except Exception as e:
        return f"Error executing {name}: {str(e)}"


# ---------- Routes ----------

VOICES = [
    {"name": "Zephyr", "style": "Bright"},
    {"name": "Kore", "style": "Firm"},
    {"name": "Orus", "style": "Firm"},
    {"name": "Autonoe", "style": "Bright"},
    {"name": "Umbriel", "style": "Easy-going"},
    {"name": "Erinome", "style": "Clear"},
    {"name": "Laomedeia", "style": "Upbeat"},
    {"name": "Schedar", "style": "Even"},
    {"name": "Achird", "style": "Friendly"},
    {"name": "Sadachbia", "style": "Lively"},
    {"name": "Puck", "style": "Upbeat"},
    {"name": "Fenrir", "style": "Excitable"},
    {"name": "Aoede", "style": "Breezy"},
    {"name": "Enceladus", "style": "Breathy"},
    {"name": "Algieba", "style": "Smooth"},
    {"name": "Algenib", "style": "Gravelly"},
    {"name": "Achernar", "style": "Soft"},
    {"name": "Gacrux", "style": "Mature"},
    {"name": "Zubenelgenubi", "style": "Casual"},
    {"name": "Sadaltager", "style": "Knowledgeable"},
    {"name": "Charon", "style": "Informative"},
    {"name": "Leda", "style": "Youthful"},
    {"name": "Callirrhoe", "style": "Easy-going"},
    {"name": "Iapetus", "style": "Clear"},
    {"name": "Despina", "style": "Smooth"},
    {"name": "Rasalgethi", "style": "Informative"},
    {"name": "Alnilam", "style": "Firm"},
    {"name": "Pulcherrima", "style": "Forward"},
    {"name": "Vindemiatrix", "style": "Gentle"},
    {"name": "Sulafat", "style": "Warm"},
]

LANGUAGES = [
    {"code": "en-US", "label": "English (US)"},
    {"code": "en-IN", "label": "English (India)"},
    {"code": "es-US", "label": "Spanish (US)"},
    {"code": "fr-FR", "label": "French"},
    {"code": "de-DE", "label": "German"},
    {"code": "it-IT", "label": "Italian"},
    {"code": "pt-BR", "label": "Portuguese (Brazil)"},
    {"code": "ja-JP", "label": "Japanese"},
    {"code": "ko-KR", "label": "Korean"},
    {"code": "ar-EG", "label": "Arabic (Egyptian)"},
    {"code": "bn-BD", "label": "Bengali"},
    {"code": "nl-NL", "label": "Dutch"},
    {"code": "hi-IN", "label": "Hindi"},
    {"code": "id-ID", "label": "Indonesian"},
    {"code": "mr-IN", "label": "Marathi"},
    {"code": "pl-PL", "label": "Polish"},
    {"code": "ro-RO", "label": "Romanian"},
    {"code": "ru-RU", "label": "Russian"},
    {"code": "ta-IN", "label": "Tamil"},
    {"code": "te-IN", "label": "Telugu"},
    {"code": "th-TH", "label": "Thai"},
    {"code": "tr-TR", "label": "Turkish"},
    {"code": "uk-UA", "label": "Ukrainian"},
    {"code": "vi-VN", "label": "Vietnamese"},
]


CONVEX_URL = os.getenv("CONVEX_URL", "")


@app.get("/")
async def root():
    return FileResponse("frontend/index.html")


@app.get("/convex-url")
async def convex_url():
    return {"url": CONVEX_URL}


@app.get("/config")
async def get_config():
    return {
        "model": MODEL,
        "voices": VOICES,
        "languages": LANGUAGES,
        "tools": [{"name": t["name"], "description": t["description"]} for t in TOOL_DECLARATIONS],
    }


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("Client connected")

    # Wait for config message from frontend
    raw = await ws.receive_text()
    user_config = json.loads(raw)
    logger.info(f"Session config: {user_config}")

    voice_name = user_config.get("voice", "Aoede")
    language = user_config.get("language", "en-US")
    system_prompt = user_config.get("systemPrompt", "")
    affective_dialog = user_config.get("affectiveDialog", False)
    proactive_audio = user_config.get("proactiveAudio", False)
    google_search = user_config.get("googleSearch", False)

    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

    audio_queue = asyncio.Queue()
    text_queue = asyncio.Queue()

    # Build tools list
    tools_list = []
    tools_list.append({"function_declarations": TOOL_DECLARATIONS})
    if google_search:
        tools_list.append({"google_search": {}})

    # Build config
    config_kwargs = {
        "response_modalities": [types.Modality.AUDIO],
        "speech_config": types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            ),
            language_code=language,
        ),
        "input_audio_transcription": types.AudioTranscriptionConfig(),
        "output_audio_transcription": types.AudioTranscriptionConfig(),
        "tools": tools_list,
    }

    if system_prompt:
        config_kwargs["system_instruction"] = types.Content(
            parts=[types.Part(text=system_prompt)]
        )

    if affective_dialog:
        config_kwargs["enable_affective_dialog"] = True

    if proactive_audio:
        config_kwargs["proactivity"] = types.ProactivityConfig(proactive_audio=True)

    config = types.LiveConnectConfig(**config_kwargs)

    try:
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            await ws.send_json({"type": "session_started"})

            async def recv_from_browser():
                try:
                    while True:
                        msg = await ws.receive()
                        if msg.get("bytes"):
                            await audio_queue.put(msg["bytes"])
                        elif msg.get("text"):
                            data = msg["text"]
                            try:
                                parsed = json.loads(data)
                                if parsed.get("type") == "text":
                                    await text_queue.put(parsed["text"])
                                    continue
                            except (json.JSONDecodeError, KeyError):
                                pass
                            await text_queue.put(data)
                except WebSocketDisconnect:
                    logger.info("Client disconnected")
                except Exception as e:
                    logger.error(f"recv error: {e}")

            async def send_audio():
                try:
                    while True:
                        chunk = await audio_queue.get()
                        await session.send_realtime_input(
                            audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
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
                            tool_call = resp.tool_call

                            # Handle tool calls
                            if tool_call:
                                function_responses = []
                                for fc in tool_call.function_calls:
                                    logger.info(f"Tool call: {fc.name}({fc.args})")
                                    result = execute_tool(fc.name, fc.args or {})
                                    logger.info(f"Tool result: {result}")
                                    function_responses.append(
                                        types.FunctionResponse(
                                            name=fc.name,
                                            id=fc.id,
                                            response={"result": result},
                                        )
                                    )
                                    await ws.send_json({
                                        "type": "tool_call",
                                        "name": fc.name,
                                        "args": fc.args or {},
                                        "result": result,
                                    })
                                await session.send_tool_response(
                                    function_responses=function_responses
                                )
                                continue

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

            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()

    except Exception as e:
        logger.error(f"Session error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass

    try:
        await ws.close()
    except Exception:
        pass

    logger.info("Session ended")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "5174"))
    ssl_key = os.getenv("SSL_KEY")
    ssl_cert = os.getenv("SSL_CERT")

    kwargs = {"host": "127.0.0.1", "port": port}
    if ssl_key and ssl_cert:
        kwargs["ssl_keyfile"] = ssl_key
        kwargs["ssl_certfile"] = ssl_cert
        kwargs["host"] = "0.0.0.0"

    uvicorn.run(app, **kwargs)
