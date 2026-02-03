# Gemini Live Voice Test — Native Audio

Minimal test for Google's Gemini Live native audio model via Vertex AI.

## Architecture

```
Browser (mic + speaker) ↔ WebSocket ↔ Python backend (FastAPI) ↔ Gemini Live API (Vertex AI)
```

The Python backend handles GCP authentication. The browser just captures/plays audio.

## Setup

### 1. GCP Auth (one of these)

**Option A — Service Account Key (easiest for servers):**
1. Go to [GCP Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/service-accounts)
2. Create a service account with **Vertex AI User** role
3. Download the JSON key
4. Set in `.env`: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`

**Option B — gcloud CLI:**
```bash
gcloud auth application-default login
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your PROJECT_ID and credentials path
```

### 3. Run

```bash
source .venv/bin/activate
python server.py
```

### 4. Open

Navigate to `https://<your-ip>:5173` (accept self-signed cert warning).

Click **Connect** → speak!

## Notes

- Model: `gemini-live-2.5-flash-preview-native-audio-09-2025` (Vertex AI only, requires OAuth)
- Audio: 16kHz PCM16 input → 24kHz PCM16 output
- Transcriptions enabled for both input and output
- HTTPS required for microphone access
