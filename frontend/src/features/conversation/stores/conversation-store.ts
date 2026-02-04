import { create } from "zustand";
import type { ConnectionStatus, TranscriptEntry } from "@/types";

interface ConversationStore {
  status: ConnectionStatus;
  statusMessage: string;
  activePersonaId: string | null;
  activePersonaName: string | null;
  currentSessionId: string | null;
  playbackSampleRate: number;
  transcript: TranscriptEntry[];

  setStatus: (status: ConnectionStatus, message?: string) => void;
  setActivePersona: (id: string | null, name?: string | null) => void;
  setCurrentSessionId: (id: string | null) => void;
  setPlaybackSampleRate: (rate: number) => void;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  updateTranscriptEntry: (id: string, text: string) => void;
  clearTranscript: () => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  status: "idle",
  statusMessage: "",
  activePersonaId: null,
  activePersonaName: null,
  currentSessionId: null,
  playbackSampleRate: 24000,
  transcript: [],

  setStatus: (status, message = "") => set({ status, statusMessage: message }),
  setActivePersona: (id, name = null) =>
    set({ activePersonaId: id, activePersonaName: name }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setPlaybackSampleRate: (rate) => set({ playbackSampleRate: rate }),
  addTranscriptEntry: (entry) =>
    set((state) => ({ transcript: [...state.transcript, entry] })),
  updateTranscriptEntry: (id, text) =>
    set((state) => ({
      transcript: state.transcript.map((e) =>
        e.id === id ? { ...e, text } : e,
      ),
    })),
  clearTranscript: () => set({ transcript: [] }),
  reset: () =>
    set({
      status: "idle",
      statusMessage: "",
      currentSessionId: null,
      playbackSampleRate: 24000,
      transcript: [],
    }),
}));
