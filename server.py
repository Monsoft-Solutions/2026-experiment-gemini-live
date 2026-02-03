import asyncio
import json
import logging
import os

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from providers import get_all_providers, get_provider, init_providers
from providers.base import EventType, ProviderConfig

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL = os.getenv("MODEL", "gemini-live-2.5-flash-preview-native-audio-09-2025")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_providers()
    yield


app = FastAPI(lifespan=lifespan)
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


# ---------- Languages (shared across providers) ----------

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


# ---------- Routes ----------

@app.get("/")
async def root():
    return FileResponse("frontend/index.html")


@app.get("/convex-url")
async def convex_url():
    return {"url": CONVEX_URL}


@app.get("/config")
async def get_config():
    providers_out = {}
    for name, provider in get_all_providers().items():
        voices = await provider.get_voices()
        providers_out[name] = provider.to_dict(voices)

    # For backward compatibility, also include top-level voices/model
    # from the default provider (gemini), so the frontend keeps working
    # before it's updated to use the providers map.
    default_voices = []
    default_model = MODEL
    try:
        gemini = get_provider("gemini")
        default_voices = [
            {"name": v.id, "style": v.style}
            for v in await gemini.get_voices()
        ]
        default_model = gemini.model
    except KeyError:
        pass

    return {
        "model": default_model,
        "voices": default_voices,
        "languages": LANGUAGES,
        "tools": [
            {"name": t["name"], "description": t["description"]}
            for t in TOOL_DECLARATIONS
        ],
        "providers": providers_out,
    }


# ---------- WebSocket ----------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("Client connected")

    # Wait for config message from frontend
    raw = await ws.receive_text()
    user_config = json.loads(raw)
    logger.info(f"Session config: {user_config}")

    # Determine provider (default to gemini for backward compat)
    provider_name = user_config.get("provider", "gemini")
    try:
        provider = get_provider(provider_name)
    except KeyError as e:
        await ws.send_json({"type": "error", "message": str(e)})
        await ws.close()
        return

    # Build provider-agnostic config
    config = ProviderConfig(
        voice=user_config.get("voice", "Aoede"),
        language=user_config.get("language", "en-US"),
        system_prompt=user_config.get("systemPrompt", ""),
        tools=TOOL_DECLARATIONS,
        affective_dialog=user_config.get("affectiveDialog", False),
        proactive_audio=user_config.get("proactiveAudio", False),
        google_search=user_config.get("googleSearch", False),
    )

    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()
    text_queue: asyncio.Queue[str] = asyncio.Queue()

    try:
        # Use connect_ctx for Gemini (async context manager pattern).
        # Future providers that don't need a context manager will
        # implement connect() directly and we'll add a branch here.
        if hasattr(provider, "connect_ctx"):
            session_cm = provider.connect_ctx(config)
        else:
            # Fallback for providers that implement connect()
            session_cm = _AsyncCMWrapper(provider, config)

        async with session_cm as session:
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
                        await session.send_audio(chunk)
                except asyncio.CancelledError:
                    pass

            async def send_text():
                try:
                    while True:
                        text = await text_queue.get()
                        await session.send_text(text)
                except asyncio.CancelledError:
                    pass

            async def recv_from_provider():
                try:
                    async for event in session.receive():
                        if event.type == EventType.AUDIO:
                            await ws.send_bytes(event.data)

                        elif event.type == EventType.TRANSCRIPT_USER:
                            await ws.send_json(
                                {"type": "user", "text": event.text}
                            )

                        elif event.type == EventType.TRANSCRIPT_AGENT:
                            await ws.send_json(
                                {"type": "gemini", "text": event.text}
                            )

                        elif event.type == EventType.TOOL_CALL:
                            logger.info(
                                f"Tool call: {event.tool_name}({event.tool_args})"
                            )
                            result = execute_tool(
                                event.tool_name, event.tool_args or {}
                            )
                            logger.info(f"Tool result: {result}")

                            # Send result to browser for display
                            await ws.send_json({
                                "type": "tool_call",
                                "name": event.tool_name,
                                "args": event.tool_args or {},
                                "result": result,
                            })

                            # Send result back to provider
                            await session.send_tool_result(
                                tool_id=event.tool_id,
                                name=event.tool_name,
                                result=result,
                            )

                        elif event.type == EventType.TURN_COMPLETE:
                            await ws.send_json({"type": "turn_complete"})

                        elif event.type == EventType.INTERRUPTED:
                            await ws.send_json({"type": "interrupted"})

                        elif event.type == EventType.ERROR:
                            await ws.send_json(
                                {"type": "error", "message": event.text}
                            )

                except Exception as e:
                    logger.error(f"provider recv error: {e}")

            tasks = [
                asyncio.create_task(recv_from_browser()),
                asyncio.create_task(send_audio()),
                asyncio.create_task(send_text()),
                asyncio.create_task(recv_from_provider()),
            ]

            done, pending = await asyncio.wait(
                tasks, return_when=asyncio.FIRST_COMPLETED
            )
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


class _AsyncCMWrapper:
    """Wrap a provider.connect() coroutine as an async context manager."""

    def __init__(self, provider, config):
        self._provider = provider
        self._config = config
        self._session = None

    async def __aenter__(self):
        self._session = await self._provider.connect(self._config)
        return self._session

    async def __aexit__(self, *exc):
        if self._session:
            await self._session.close()
        return False


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
