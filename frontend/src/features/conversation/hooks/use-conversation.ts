import { useCallback, useRef } from "react";
import { WS_URL } from "@/config";
import { convexMutation } from "@/lib/convex";
import type { SessionSettings, WsMessage } from "@/types";
import { useConversationStore } from "../stores/conversation-store";
import { useAudioCapture } from "./use-audio-capture";
import { useAudioPlayback } from "./use-audio-playback";

let entryCounter = 0;
function nextEntryId() {
  return `entry-${++entryCounter}-${Date.now()}`;
}

export function useConversation() {
  const wsRef = useRef<WebSocket | null>(null);
  const currentUserRef = useRef<{ id: string; text: string } | null>(null);
  const currentGeminiRef = useRef<{ id: string; text: string } | null>(null);

  const { play, stopAll, setAudioContext } = useAudioPlayback();

  const onAudioData = useCallback((pcm16: ArrayBuffer) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(pcm16);
    }
  }, []);

  const audioCapture = useAudioCapture({ onAudioData });

  const saveMessage = useCallback(
    async (role: string, text: string) => {
      const sessionId = useConversationStore.getState().currentSessionId;
      if (!sessionId || !text.trim()) return;
      try {
        await convexMutation("sessions:addMessage", {
          sessionId,
          role,
          text: text.trim(),
        });
      } catch (e) {
        console.error("Failed to save message:", e);
      }
    },
    [],
  );

  const flushPendingMessages = useCallback(() => {
    if (currentUserRef.current?.text) {
      saveMessage("user", currentUserRef.current.text);
    }
    if (currentGeminiRef.current?.text) {
      saveMessage("gemini", currentGeminiRef.current.text);
    }
    currentUserRef.current = null;
    currentGeminiRef.current = null;
  }, [saveMessage]);

  const connect = useCallback(
    async (
      config: SessionSettings,
      personaName: string | null,
      onDisconnect: () => void,
    ) => {
      const {
        setStatus,
        setCurrentSessionId,
        setPlaybackSampleRate,
        addTranscriptEntry,
        updateTranscriptEntry,
        clearTranscript,
      } = useConversationStore.getState();

      clearTranscript();
      setStatus("connecting", "Connecting...");

      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connecting", "Sending config...");
        ws.send(JSON.stringify(config));
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          const rate = useConversationStore.getState().playbackSampleRate;
          play(event.data, rate);
          return;
        }

        try {
          const msg = JSON.parse(event.data) as WsMessage;

          if (msg.type === "session_started") {
            setPlaybackSampleRate(msg.outputSampleRate || 24000);
            setStatus("connecting", "Starting mic...");

            // Start Convex session
            try {
              const sessionId = await convexMutation<string>(
                "sessions:create",
                {
                  personaName: personaName || undefined,
                  settings: config,
                },
              );
              setCurrentSessionId(sessionId);
            } catch (e) {
              console.error("Failed to create session:", e);
            }

            // Start mic capture
            try {
              const ctx = await audioCapture.start();
              setAudioContext(ctx);
              setStatus("connected", "Listening... speak now!");
            } catch (err) {
              setStatus(
                "error",
                `Mic error: ${err instanceof Error ? err.message : "unknown"}`,
              );
              ws.close();
            }
            return;
          }

          if (msg.type === "error") {
            setStatus("error", msg.message);
            return;
          }

          if (msg.type === "tool_call") {
            addTranscriptEntry({
              id: nextEntryId(),
              role: "tool",
              text: `${msg.name}(${JSON.stringify(msg.args)}) → ${msg.result}`,
            });
            return;
          }

          if (msg.type === "user") {
            if (currentUserRef.current) {
              currentUserRef.current.text += msg.text;
              updateTranscriptEntry(
                currentUserRef.current.id,
                currentUserRef.current.text,
              );
            } else {
              const id = nextEntryId();
              currentUserRef.current = { id, text: msg.text };
              addTranscriptEntry({
                id,
                role: "user",
                text: msg.text,
                pending: true,
              });
            }
          } else if (msg.type === "gemini") {
            if (currentGeminiRef.current) {
              currentGeminiRef.current.text += msg.text;
              updateTranscriptEntry(
                currentGeminiRef.current.id,
                currentGeminiRef.current.text,
              );
            } else {
              const id = nextEntryId();
              currentGeminiRef.current = { id, text: msg.text };
              addTranscriptEntry({
                id,
                role: "gemini",
                text: msg.text,
                pending: true,
              });
            }
          } else if (
            msg.type === "turn_complete" ||
            msg.type === "interrupted"
          ) {
            if (msg.type === "interrupted") {
              stopAll();
            }
            flushPendingMessages();
          }
        } catch (e) {
          console.error("WS parse error:", e);
        }
      };

      ws.onclose = async () => {
        flushPendingMessages();
        audioCapture.stop();
        stopAll();

        // End Convex session
        const sessionId = useConversationStore.getState().currentSessionId;
        if (sessionId) {
          try {
            await convexMutation("sessions:end", { id: sessionId });
          } catch (e) {
            console.error("Failed to end session:", e);
          }
        }

        setStatus("idle", "Disconnected");
        setCurrentSessionId(null);
        onDisconnect();
      };

      ws.onerror = (e) => {
        console.error("WS error:", e);
        setStatus("error", "Connection error");
      };
    },
    [audioCapture, flushPendingMessages, play, setAudioContext, stopAll],
  );

  const disconnect = useCallback(() => {
    audioCapture.stop();
    stopAll();
    wsRef.current?.close();
  }, [audioCapture, stopAll]);

  const sendText = useCallback(
    (text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return;
      ws.send(JSON.stringify({ type: "text", text }));

      const { addTranscriptEntry } = useConversationStore.getState();
      addTranscriptEntry({
        id: nextEntryId(),
        role: "user",
        text,
      });
      saveMessage("user", text);
    },
    [saveMessage],
  );

  return { connect, disconnect, sendText };
}
