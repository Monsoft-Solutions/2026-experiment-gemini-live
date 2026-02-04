import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsStore {
  provider: string;
  voice: string;
  language: string;
  systemPrompt: string;
  affectiveDialog: boolean;
  proactiveAudio: boolean;
  googleSearch: boolean;

  setProvider: (provider: string) => void;
  setVoice: (voice: string) => void;
  setLanguage: (language: string) => void;
  setSystemPrompt: (prompt: string) => void;
  setAffectiveDialog: (on: boolean) => void;
  setProactiveAudio: (on: boolean) => void;
  setGoogleSearch: (on: boolean) => void;
  loadFromPersona: (data: {
    provider: string;
    voice: string;
    language: string;
    systemPrompt: string;
    affectiveDialog: boolean;
    proactiveAudio: boolean;
    googleSearch: boolean;
  }) => void;
  getSessionConfig: () => {
    provider: string;
    voice: string;
    language: string;
    systemPrompt: string;
    affectiveDialog: boolean;
    proactiveAudio: boolean;
    googleSearch: boolean;
  };
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      provider: "gemini",
      voice: "Aoede",
      language: "en-US",
      systemPrompt: "",
      affectiveDialog: false,
      proactiveAudio: false,
      googleSearch: false,

      setProvider: (provider) => set({ provider }),
      setVoice: (voice) => set({ voice }),
      setLanguage: (language) => set({ language }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      setAffectiveDialog: (on) => set({ affectiveDialog: on }),
      setProactiveAudio: (on) => set({ proactiveAudio: on }),
      setGoogleSearch: (on) => set({ googleSearch: on }),
      loadFromPersona: (data) => set(data),
      getSessionConfig: () => {
        const s = get();
        return {
          provider: s.provider,
          voice: s.voice,
          language: s.language,
          systemPrompt: s.systemPrompt,
          affectiveDialog: s.affectiveDialog,
          proactiveAudio: s.proactiveAudio,
          googleSearch: s.googleSearch,
        };
      },
    }),
    {
      name: "gemini-live-settings",
    },
  ),
);
