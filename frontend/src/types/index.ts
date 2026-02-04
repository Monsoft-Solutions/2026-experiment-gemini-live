// --- Provider & Config ---

export interface VoiceOption {
  id: string;
  name: string;
  style: string;
}

export interface ProviderConfig {
  displayName: string;
  voices: VoiceOption[];
  outputSampleRate: number;
}

export interface LanguageOption {
  code: string;
  label: string;
}

export interface ServerConfig {
  model: string;
  providers: Record<string, ProviderConfig>;
  languages: LanguageOption[];
}

// --- Persona ---

export interface Persona {
  _id: string;
  name: string;
  provider: string;
  voice: string;
  language: string;
  systemPrompt: string;
  affectiveDialog: boolean;
  proactiveAudio: boolean;
  googleSearch: boolean;
}

export type PersonaFormData = Omit<Persona, "_id">;

// --- Session ---

export interface SessionSettings {
  provider: string;
  voice: string;
  language: string;
  systemPrompt: string;
  affectiveDialog: boolean;
  proactiveAudio: boolean;
  googleSearch: boolean;
}

export interface Session {
  _id: string;
  personaName?: string;
  settings: SessionSettings;
  startedAt: number;
  endedAt?: number;
  duration?: number;
}

export interface SessionMessage {
  _id: string;
  sessionId: string;
  role: "user" | "gemini";
  text: string;
  timestamp: number;
}

// --- WebSocket Messages ---

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface WsSessionStarted {
  type: "session_started";
  outputSampleRate: number;
}

export interface WsError {
  type: "error";
  message: string;
}

export interface WsToolCall {
  type: "tool_call";
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface WsTranscript {
  type: "user" | "gemini";
  text: string;
}

export interface WsTurnComplete {
  type: "turn_complete";
}

export interface WsInterrupted {
  type: "interrupted";
}

export type WsMessage =
  | WsSessionStarted
  | WsError
  | WsToolCall
  | WsTranscript
  | WsTurnComplete
  | WsInterrupted;

// --- Transcript ---

export interface TranscriptEntry {
  id: string;
  role: "user" | "gemini" | "tool";
  text: string;
  pending?: boolean;
}

// --- Twilio / Admin ---

export interface TwilioConfig {
  configured: boolean;
  accountSid?: string;
  authToken?: string;
  webhookBaseUrl?: string;
}

export interface PhoneNumber {
  twilioSid: string;
  phoneNumber: string;
  friendlyName?: string;
  linked: boolean;
  linkId?: string;
  personaId?: string;
}

export interface CallRecord {
  _id: string;
  from: string;
  to: string;
  status: string;
  personaName?: string;
  provider?: string;
  startedAt: number;
  duration?: number;
  transcript?: string;
}

export interface CallDetail {
  call: CallRecord;
  messages: Array<{
    role: "caller" | "agent";
    text: string;
  }>;
}
