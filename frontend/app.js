// --- DOM ---
const talkBtn = document.getElementById("talkBtn");
const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const settingsPanel = document.getElementById("settingsPanel");
const voiceSelect = document.getElementById("voiceSelect");
const langSelect = document.getElementById("langSelect");
const systemPrompt = document.getElementById("systemPrompt");
const affectiveToggle = document.getElementById("affectiveToggle");
const proactiveToggle = document.getElementById("proactiveToggle");
const modelNameEl = document.getElementById("modelName");
const textInputRow = document.getElementById("textInputRow");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");

// --- State ---
let ws = null;
let audioCtx = null;
let mediaStream = null;
let workletNode = null;
let isConnected = false;
let nextStartTime = 0;
let scheduledSources = [];
let currentUserDiv = null;
let currentGeminiDiv = null;

// --- Init: Load config from server ---
async function loadConfig() {
  try {
    const res = await fetch("/config");
    const cfg = await res.json();

    modelNameEl.textContent = cfg.model;

    voiceSelect.innerHTML = cfg.voices
      .map((v) => `<option value="${v.name}">${v.name} — ${v.style}</option>`)
      .join("");
    voiceSelect.value = "Aoede";

    langSelect.innerHTML = cfg.languages
      .map((l) => `<option value="${l.code}">${l.label}</option>`)
      .join("");
    langSelect.value = "en-US";

    // Restore saved settings
    const saved = localStorage.getItem("gemini-live-settings");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.voice) voiceSelect.value = s.voice;
        if (s.language) langSelect.value = s.language;
        if (s.systemPrompt) systemPrompt.value = s.systemPrompt;
        if (s.affectiveDialog) affectiveToggle.checked = s.affectiveDialog;
        if (s.proactiveAudio) proactiveToggle.checked = s.proactiveAudio;
      } catch (e) {}
    }
  } catch (e) {
    console.error("Failed to load config:", e);
  }
}

function saveSettings() {
  localStorage.setItem(
    "gemini-live-settings",
    JSON.stringify({
      voice: voiceSelect.value,
      language: langSelect.value,
      systemPrompt: systemPrompt.value,
      affectiveDialog: affectiveToggle.checked,
      proactiveAudio: proactiveToggle.checked,
    })
  );
}

function getSessionConfig() {
  return {
    voice: voiceSelect.value,
    language: langSelect.value,
    systemPrompt: systemPrompt.value.trim(),
    affectiveDialog: affectiveToggle.checked,
    proactiveAudio: proactiveToggle.checked,
  };
}

// --- Helpers ---
function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function appendMsg(type, text) {
  const p = document.createElement("p");
  p.className = type;
  p.textContent = `${type === "user" ? "You" : "Gemini"}: ${text}`;
  transcriptEl.appendChild(p);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  return p;
}

// --- Audio Playback (24kHz PCM16 from Gemini) ---
function playPCM(arrayBuffer) {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const pcm = new Int16Array(arrayBuffer);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 32768.0;

  const buffer = audioCtx.createBuffer(1, float32.length, 24000);
  buffer.getChannelData(0).set(float32);

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  nextStartTime = Math.max(now, nextStartTime);
  source.start(nextStartTime);
  nextStartTime += buffer.duration;

  scheduledSources.push(source);
  source.onended = () => {
    const idx = scheduledSources.indexOf(source);
    if (idx > -1) scheduledSources.splice(idx, 1);
  };
}

function stopPlayback() {
  scheduledSources.forEach((s) => {
    try { s.stop(); } catch (e) {}
  });
  scheduledSources = [];
  if (audioCtx) nextStartTime = audioCtx.currentTime;
}

// --- Mic Capture ---
function downsample(buffer, fromRate, toRate) {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const len = Math.round(buffer.length / ratio);
  const result = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const start = Math.round(i * ratio);
    const end = Math.round((i + 1) * ratio);
    let sum = 0, count = 0;
    for (let j = start; j < end && j < buffer.length; j++) { sum += buffer[j]; count++; }
    result[i] = sum / count;
  }
  return result;
}

function float32ToInt16(buffer) {
  const buf = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    buf[i] = Math.min(1, Math.max(-1, buffer[i])) * 0x7fff;
  }
  return buf.buffer;
}

async function startMic() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.audioWorklet.addModule("/static/pcm-processor.js");

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = audioCtx.createMediaStreamSource(mediaStream);
  workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");

  workletNode.port.onmessage = (e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const downsampled = downsample(e.data, audioCtx.sampleRate, 16000);
    const pcm16 = float32ToInt16(downsampled);
    ws.send(pcm16);
  };

  source.connect(workletNode);
  const mute = audioCtx.createGain();
  mute.gain.value = 0;
  workletNode.connect(mute);
  mute.connect(audioCtx.destination);
}

function stopMic() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }
}

// --- WebSocket ---
function connect() {
  saveSettings();

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    setStatus("Sending config...");
    // Send session config as first message
    ws.send(JSON.stringify(getSessionConfig()));
  };

  ws.onmessage = async (event) => {
    if (event.data instanceof ArrayBuffer) {
      playPCM(event.data);
      return;
    }

    try {
      const msg = JSON.parse(event.data);

      if (msg.type === "session_started") {
        // Session established, start mic
        setStatus("Session started — starting mic...", "success");
        try {
          await startMic();
          isConnected = true;
          settingsPanel.style.display = "none";
          textInputRow.classList.add("visible");
          talkBtn.classList.add("active");
          talkBtn.textContent = "Disconnect";
          talkBtn.disabled = false;
          setStatus("Listening... speak now!", "success");
        } catch (err) {
          setStatus("Mic error: " + err.message, "error");
          ws.close();
        }
        return;
      }

      if (msg.type === "error") {
        setStatus("Error: " + msg.message, "error");
        return;
      }

      if (msg.type === "user") {
        if (currentUserDiv) {
          currentUserDiv.textContent += msg.text;
          transcriptEl.scrollTop = transcriptEl.scrollHeight;
        } else {
          currentUserDiv = appendMsg("user", msg.text);
        }
      } else if (msg.type === "gemini") {
        if (currentGeminiDiv) {
          currentGeminiDiv.textContent += msg.text;
          transcriptEl.scrollTop = transcriptEl.scrollHeight;
        } else {
          currentGeminiDiv = appendMsg("gemini", msg.text);
        }
      } else if (msg.type === "turn_complete") {
        currentUserDiv = null;
        currentGeminiDiv = null;
      } else if (msg.type === "interrupted") {
        stopPlayback();
        currentUserDiv = null;
        currentGeminiDiv = null;
      }
    } catch (e) {
      console.error("parse error", e);
    }
  };

  ws.onclose = () => {
    isConnected = false;
    stopMic();
    stopPlayback();
    settingsPanel.style.display = "";
    textInputRow.classList.remove("visible");
    talkBtn.classList.remove("active");
    talkBtn.textContent = "Connect";
    talkBtn.disabled = false;
    setStatus("Disconnected");
  };

  ws.onerror = (e) => {
    console.error("WS error", e);
    setStatus("Connection error", "error");
  };
}

function disconnect() {
  stopMic();
  stopPlayback();
  if (ws) ws.close();
  ws = null;
  isConnected = false;
  settingsPanel.style.display = "";
  textInputRow.classList.remove("visible");
  talkBtn.classList.remove("active");
  talkBtn.textContent = "Connect";
  setStatus("Disconnected");
}

function sendText() {
  const text = textInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "text", text }));
  appendMsg("user", text);
  textInput.value = "";
}

// --- Events ---
talkBtn.addEventListener("click", () => {
  if (isConnected) {
    disconnect();
  } else {
    talkBtn.disabled = true;
    setStatus("Connecting...");
    connect();
  }
});

sendBtn.addEventListener("click", sendText);
textInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendText();
});

// --- Init ---
loadConfig();
