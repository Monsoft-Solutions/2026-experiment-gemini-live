// --- Convex Setup ---
// Use raw HTTP API since we're vanilla JS without a build step
let convexUrl = null;

class ConvexAPI {
  constructor(url) {
    this.url = url;
  }
  async _call(type, name, args = {}) {
    const res = await fetch(`${this.url}/api/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: name, args, format: "json" }),
    });
    if (!res.ok) throw new Error(`Convex ${type} failed: ${res.status}`);
    const data = await res.json();
    return data.value;
  }
  async query(name, args = {}) { return this._call("query", name, args); }
  async mutation(name, args = {}) { return this._call("mutation", name, args); }
}

let convex = null;

// --- DOM ---
const talkBtn = document.getElementById("talkBtn");
const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const settingsPanel = document.getElementById("settingsPanel");
const providerSelect = document.getElementById("providerSelect");
const voiceSelect = document.getElementById("voiceSelect");
const langSelect = document.getElementById("langSelect");
const systemPrompt = document.getElementById("systemPrompt");
const affectiveToggle = document.getElementById("affectiveToggle");
const proactiveToggle = document.getElementById("proactiveToggle");
const googleSearchToggle = document.getElementById("googleSearchToggle");
const modelNameEl = document.getElementById("modelName");
const textInputRow = document.getElementById("textInputRow");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const personaList = document.getElementById("personaList");
const historyList = document.getElementById("historyList");
const savePersonaBtn = document.getElementById("savePersonaBtn");
const newPersonaBtn = document.getElementById("newPersonaBtn");

// Modals
const historyModal = document.getElementById("historyModal");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalMessages = document.getElementById("modalMessages");
const personaModal = document.getElementById("personaModal");
const closePersonaModal = document.getElementById("closePersonaModal");
const personaModalTitle = document.getElementById("personaModalTitle");
const personaNameInput = document.getElementById("personaNameInput");
const confirmPersonaBtn = document.getElementById("confirmPersonaBtn");
const deletePersonaBtn = document.getElementById("deletePersonaBtn");

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
let currentSessionId = null; // Convex session ID
let currentUserText = "";
let currentGeminiText = "";
let editingPersonaId = null;
let personas = [];
let providersConfig = {}; // { name: { displayName, voices[], outputSampleRate } }
let playbackSampleRate = 24000; // Default, overridden per provider on session start

// --- Init ---
async function init() {
  await loadServerConfig();
  await initConvex();
  await loadPersonas();
  await loadHistory();
}

async function loadServerConfig() {
  try {
    const res = await fetch("/config");
    const cfg = await res.json();
    modelNameEl.textContent = cfg.model;

    // Store providers config
    providersConfig = cfg.providers || {};

    // Populate provider dropdown
    const providerNames = Object.keys(providersConfig);
    if (providerNames.length > 0) {
      providerSelect.innerHTML = providerNames
        .map((name) => {
          const p = providersConfig[name];
          return `<option value="${name}">${p.displayName}</option>`;
        })
        .join("");
      providerSelect.value = providerNames.includes("gemini") ? "gemini" : providerNames[0];
      providerSelect.addEventListener("change", onProviderChange);
    } else {
      providerSelect.innerHTML = '<option value="gemini">Gemini Live</option>';
    }

    // Populate voices for selected provider
    updateVoicesForProvider();

    // Languages (shared across providers)
    langSelect.innerHTML = cfg.languages
      .map((l) => `<option value="${l.code}">${l.label}</option>`)
      .join("");
    langSelect.value = "en-US";
  } catch (e) {
    console.error("Failed to load config:", e);
  }
}

function onProviderChange() {
  updateVoicesForProvider();
  // Update UI hints based on provider
  const provider = providerSelect.value;
  const cfg = providersConfig[provider];
  if (cfg) {
    modelNameEl.textContent = cfg.displayName;
    // Toggle Gemini-specific options visibility
    const isGemini = provider === "gemini";
    document.querySelectorAll(".gemini-only").forEach((el) => {
      el.style.display = isGemini ? "" : "none";
    });
  }
}

function updateVoicesForProvider() {
  const provider = providerSelect.value;
  const cfg = providersConfig[provider];
  if (!cfg || !cfg.voices) return;

  voiceSelect.innerHTML = cfg.voices
    .map((v) => `<option value="${v.id}">${v.name} — ${v.style}</option>`)
    .join("");

  // Select a sensible default
  if (provider === "gemini") {
    const aoede = cfg.voices.find((v) => v.id === "Aoede");
    if (aoede) voiceSelect.value = aoede.id;
  } else if (cfg.voices.length > 0) {
    voiceSelect.value = cfg.voices[0].id;
  }
}

async function initConvex() {
  try {
    // Fetch the Convex URL from server
    const res = await fetch("/convex-url");
    const data = await res.json();
    convex = new ConvexAPI(data.url);
  } catch (e) {
    console.warn("Convex not available, persistence disabled:", e);
  }
}

// --- Personas ---
async function loadPersonas() {
  if (!convex) return;
  try {
    personas = await convex.query("personas:list");
    renderPersonas();
  } catch (e) {
    console.error("Failed to load personas:", e);
  }
}

function renderPersonas() {
  personaList.innerHTML = personas.length === 0
    ? '<div class="sidebar-item"><span class="meta">No personas yet</span></div>'
    : personas.map((p) => {
        const providerLabel = p.provider ? (providersConfig[p.provider]?.displayName || p.provider) : "";
        const meta = providerLabel ? `${providerLabel} · ${p.voice}` : p.voice;
        return `
        <div class="sidebar-item" data-persona-id="${p._id}">
          <span class="name">${p.name}</span>
          <span class="meta">${meta}</span>
        </div>
      `;
      }).join("");

  personaList.querySelectorAll("[data-persona-id]").forEach((el) => {
    el.addEventListener("click", () => loadPersona(el.dataset.personaId));
    el.addEventListener("dblclick", () => editPersona(el.dataset.personaId));
  });
}

function loadPersona(id) {
  const p = personas.find((p) => p._id === id);
  if (!p) return;

  // Set provider first (if stored), then update voices, then set voice
  if (p.provider && providersConfig[p.provider]) {
    providerSelect.value = p.provider;
    onProviderChange();
  }
  voiceSelect.value = p.voice;
  langSelect.value = p.language;
  systemPrompt.value = p.systemPrompt;
  affectiveToggle.checked = p.affectiveDialog;
  proactiveToggle.checked = p.proactiveAudio;
  googleSearchToggle.checked = p.googleSearch;

  personaList.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.personaId === id);
  });
}

function editPersona(id) {
  const p = personas.find((p) => p._id === id);
  if (!p) return;
  editingPersonaId = id;
  personaNameInput.value = p.name;
  personaModalTitle.textContent = "Edit Persona";
  deletePersonaBtn.style.display = "block";
  personaModal.classList.add("show");
}

function openSavePersonaModal() {
  // If a persona is currently selected, default to editing it
  const activeEl = personaList.querySelector(".sidebar-item.active");
  if (activeEl) {
    const activeId = activeEl.dataset.personaId;
    const p = personas.find((p) => p._id === activeId);
    if (p) {
      editingPersonaId = activeId;
      personaNameInput.value = p.name;
      personaModalTitle.textContent = "Update Persona";
      deletePersonaBtn.style.display = "block";
      personaModal.classList.add("show");
      personaNameInput.focus();
      return;
    }
  }
  // No active persona — create new
  editingPersonaId = null;
  personaNameInput.value = "";
  personaModalTitle.textContent = "Save as Persona";
  deletePersonaBtn.style.display = "none";
  personaModal.classList.add("show");
  personaNameInput.focus();
}

async function savePersona() {
  if (!convex) return;
  const name = personaNameInput.value.trim();
  if (!name) return;

  const data = {
    name,
    provider: providerSelect.value,
    voice: voiceSelect.value,
    language: langSelect.value,
    systemPrompt: systemPrompt.value.trim(),
    affectiveDialog: affectiveToggle.checked,
    proactiveAudio: proactiveToggle.checked,
    googleSearch: googleSearchToggle.checked,
  };

  try {
    if (editingPersonaId) {
      await convex.mutation("personas:update", { id: editingPersonaId, ...data });
    } else {
      await convex.mutation("personas:create", data);
    }
    personaModal.classList.remove("show");
    await loadPersonas();
  } catch (e) {
    console.error("Failed to save persona:", e);
  }
}

async function deletePersona() {
  if (!convex || !editingPersonaId) return;
  try {
    await convex.mutation("personas:remove", { id: editingPersonaId });
    personaModal.classList.remove("show");
    await loadPersonas();
  } catch (e) {
    console.error("Failed to delete persona:", e);
  }
}

// --- Session History ---
async function loadHistory() {
  if (!convex) return;
  try {
    const sessions = await convex.query("sessions:list", { limit: 30 });
    renderHistory(sessions);
  } catch (e) {
    console.error("Failed to load history:", e);
  }
}

function renderHistory(sessions) {
  if (sessions.length === 0) {
    historyList.innerHTML = '<div class="sidebar-item"><span class="meta">No sessions yet</span></div>';
    return;
  }
  historyList.innerHTML = sessions.map((s) => {
    const date = new Date(s.startedAt);
    const provTag = s.settings.provider && s.settings.provider !== "gemini"
      ? `[${s.settings.provider}] ` : "";
    const label = provTag + (s.personaName || s.settings.voice);
    const dur = s.duration ? `${Math.floor(s.duration / 60)}m${s.duration % 60}s` : "active";
    return `
      <div class="sidebar-item" data-session-id="${s._id}">
        <span class="name">${label}</span>
        <span class="meta">${date.toLocaleDateString()} · ${dur}</span>
      </div>
    `;
  }).join("");

  historyList.querySelectorAll("[data-session-id]").forEach((el) => {
    el.addEventListener("click", () => showSessionDetail(el.dataset.sessionId));
  });
}

async function showSessionDetail(id) {
  if (!convex) return;
  try {
    const [session, messages] = await Promise.all([
      convex.query("sessions:get", { id }),
      convex.query("sessions:getMessages", { sessionId: id }),
    ]);
    if (!session) return;

    const date = new Date(session.startedAt);
    const dur = session.duration ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s` : "ongoing";
    modalTitle.textContent = session.personaName || "Session";
    const providerName = session.settings.provider
      ? (providersConfig[session.settings.provider]?.displayName || session.settings.provider)
      : "Gemini";
    modalMeta.innerHTML = `
      <strong>Date:</strong> ${date.toLocaleString()}<br>
      <strong>Duration:</strong> ${dur}<br>
      <strong>Provider:</strong> ${providerName} · <strong>Voice:</strong> ${session.settings.voice} · <strong>Language:</strong> ${session.settings.language}<br>
      ${session.settings.systemPrompt ? `<strong>Prompt:</strong> ${session.settings.systemPrompt.slice(0, 100)}...` : ""}
    `;
    modalMessages.innerHTML = messages.length === 0
      ? "<p>No transcript recorded</p>"
      : messages.map((m) => `<p class="${m.role}">${m.role === "user" ? "You" : providerName}: ${m.text}</p>`).join("");

    historyModal.classList.add("show");
  } catch (e) {
    console.error("Failed to load session:", e);
  }
}

// --- Helpers ---
function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function getProviderLabel() {
  const cfg = providersConfig[providerSelect.value];
  return cfg?.displayName || "AI";
}

function appendMsg(type, text) {
  const p = document.createElement("p");
  p.className = type;
  const label = type === "user" ? "You" : type === "gemini" ? getProviderLabel() : "🔧";
  p.textContent = `${label}: ${text}`;
  transcriptEl.appendChild(p);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  return p;
}

function getSessionConfig() {
  const activePersona = personaList.querySelector(".sidebar-item.active");
  const persona = activePersona ? personas.find((p) => p._id === activePersona.dataset.personaId) : null;
  return {
    provider: providerSelect.value,
    voice: voiceSelect.value,
    language: langSelect.value,
    systemPrompt: systemPrompt.value.trim(),
    affectiveDialog: affectiveToggle.checked,
    proactiveAudio: proactiveToggle.checked,
    googleSearch: googleSearchToggle.checked,
    _personaName: persona?.name || null,
  };
}

// --- Audio Playback (24kHz PCM16) ---
function playPCM(arrayBuffer) {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const pcm = new Int16Array(arrayBuffer);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 32768.0;

  const buffer = audioCtx.createBuffer(1, float32.length, playbackSampleRate);
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
  scheduledSources.forEach((s) => { try { s.stop(); } catch (e) {} });
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
  if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
  if (workletNode) { workletNode.disconnect(); workletNode = null; }
}

// --- Convex session tracking ---
async function startConvexSession(config) {
  if (!convex) return;
  try {
    const { _personaName, ...settings } = config;
    currentSessionId = await convex.mutation("sessions:create", {
      personaName: _personaName || undefined,
      settings,
    });
  } catch (e) {
    console.error("Failed to create session:", e);
  }
}

async function endConvexSession() {
  if (!convex || !currentSessionId) return;
  try {
    await convex.mutation("sessions:end", { id: currentSessionId });
  } catch (e) {
    console.error("Failed to end session:", e);
  }
  currentSessionId = null;
}

async function saveMessage(role, text) {
  if (!convex || !currentSessionId || !text.trim()) return;
  try {
    await convex.mutation("sessions:addMessage", {
      sessionId: currentSessionId,
      role,
      text: text.trim(),
    });
  } catch (e) {
    console.error("Failed to save message:", e);
  }
}

// --- WebSocket ---
function connect() {
  const config = getSessionConfig();
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    setStatus("Sending config...");
    const { _personaName, ...serverConfig } = config;
    ws.send(JSON.stringify(serverConfig));
  };

  ws.onmessage = async (event) => {
    if (event.data instanceof ArrayBuffer) {
      playPCM(event.data);
      return;
    }

    try {
      const msg = JSON.parse(event.data);

      if (msg.type === "session_started") {
        // Set playback sample rate from server (provider-specific)
        playbackSampleRate = msg.outputSampleRate || 24000;
        setStatus("Session started — starting mic...", "success");
        await startConvexSession(config);
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

      if (msg.type === "tool_call") {
        appendMsg("tool", `${msg.name}(${JSON.stringify(msg.args)}) → ${msg.result}`);
        return;
      }

      if (msg.type === "user") {
        if (currentUserDiv) {
          currentUserText += msg.text;
          currentUserDiv.textContent = "You: " + currentUserText;
          transcriptEl.scrollTop = transcriptEl.scrollHeight;
        } else {
          currentUserText = msg.text;
          currentUserDiv = appendMsg("user", msg.text);
        }
      } else if (msg.type === "gemini") {
        if (currentGeminiDiv) {
          currentGeminiText += msg.text;
          currentGeminiDiv.textContent = getProviderLabel() + ": " + currentGeminiText;
          transcriptEl.scrollTop = transcriptEl.scrollHeight;
        } else {
          currentGeminiText = msg.text;
          currentGeminiDiv = appendMsg("gemini", msg.text);
        }
      } else if (msg.type === "turn_complete") {
        // Save completed messages to Convex
        if (currentUserText) saveMessage("user", currentUserText);
        if (currentGeminiText) saveMessage("gemini", currentGeminiText);
        currentUserDiv = null;
        currentGeminiDiv = null;
        currentUserText = "";
        currentGeminiText = "";
      } else if (msg.type === "interrupted") {
        stopPlayback();
        if (currentUserText) saveMessage("user", currentUserText);
        if (currentGeminiText) saveMessage("gemini", currentGeminiText);
        currentUserDiv = null;
        currentGeminiDiv = null;
        currentUserText = "";
        currentGeminiText = "";
      }
    } catch (e) {
      console.error("parse error", e);
    }
  };

  ws.onclose = async () => {
    isConnected = false;
    stopMic();
    stopPlayback();
    await endConvexSession();
    await loadHistory();
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
}

function sendText() {
  const text = textInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "text", text }));
  appendMsg("user", text);
  saveMessage("user", text);
  textInput.value = "";
}

// --- Events ---
talkBtn.addEventListener("click", () => {
  if (isConnected) { disconnect(); }
  else { talkBtn.disabled = true; setStatus("Connecting..."); connect(); }
});

sendBtn.addEventListener("click", sendText);
textInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendText(); });

sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("hidden"));
savePersonaBtn.addEventListener("click", openSavePersonaModal);
newPersonaBtn.addEventListener("click", openSavePersonaModal);
confirmPersonaBtn.addEventListener("click", savePersona);
deletePersonaBtn.addEventListener("click", deletePersona);
closePersonaModal.addEventListener("click", () => personaModal.classList.remove("show"));
closeModal.addEventListener("click", () => historyModal.classList.remove("show"));

historyModal.addEventListener("click", (e) => { if (e.target === historyModal) historyModal.classList.remove("show"); });
personaModal.addEventListener("click", (e) => { if (e.target === personaModal) personaModal.classList.remove("show"); });

// --- Start ---
init();
