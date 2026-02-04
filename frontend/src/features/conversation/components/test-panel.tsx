import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConversationStore } from "../stores/conversation-store";

interface TestPanelProps {
  providerName: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendText: (text: string) => void;
}

export function TestPanel({
  providerName,
  onConnect,
  onDisconnect,
  onSendText,
}: TestPanelProps) {
  const status = useConversationStore((s) => s.status);
  const statusMessage = useConversationStore((s) => s.statusMessage);
  const transcript = useConversationStore((s) => s.transcript);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isError = status === "error";
  const isIdle = status === "idle";

  const [textValue, setTextValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Timer
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!isConnected) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Auto-scroll transcript
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleSend = useCallback(() => {
    const text = textValue.trim();
    if (!text) return;
    onSendText(text);
    setTextValue("");
  }, [textValue, onSendText]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timerDisplay = `${mins}:${secs.toString().padStart(2, "0")}`;
  const aiLabel = providerName || "AI";

  return (
    <div className="flex h-full flex-col">
      {/* Idle state — big connect prompt */}
      {isIdle && transcript.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
          <div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
            <Mic className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Test your agent configuration
            </p>
            <p className="text-xs text-muted-foreground/60">
              Start a voice conversation to hear how your agent sounds
            </p>
          </div>
          <Button onClick={onConnect} className="gap-2">
            <Mic className="size-4" />
            Start Test
          </Button>
        </div>
      )}

      {/* Connected / Connecting state */}
      {(isConnected || isConnecting) && (
        <>
          {/* Status bar */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            {isConnecting && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            )}
            {isConnected && (
              <div className="relative flex items-center justify-center">
                <span className="absolute size-3 rounded-full bg-primary/30 motion-safe:animate-ping" />
                <span className="relative size-2 rounded-full bg-primary" />
              </div>
            )}
            <span className="text-xs font-medium">
              {isConnecting ? "Connecting..." : "Live"}
            </span>
            {isConnected && (
              <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
                <Timer className="size-3" />
                {timerDisplay}
              </span>
            )}
            {statusMessage && isConnecting && (
              <span className="text-[10px] text-muted-foreground">
                {statusMessage}
              </span>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={onDisconnect}
              className="ml-auto h-6 gap-1 px-2 text-[10px]"
            >
              <MicOff className="size-3" />
              Stop
            </Button>
          </div>

          {/* Transcript */}
          <ScrollArea className="flex-1">
            <div
              role="log"
              aria-label="Test conversation transcript"
              aria-live="polite"
              className="space-y-1 p-3"
            >
              {transcript.length === 0 && isConnected && (
                <div className="flex items-center justify-center gap-2 py-8 text-center">
                  <MessageSquare className="size-5 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">
                    Listening... speak to test
                  </p>
                </div>
              )}
              {transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-xs transition-all duration-200 motion-safe:animate-in motion-safe:fade-in",
                    entry.role === "user" && "bg-blue-500/10 text-blue-400",
                    entry.role === "gemini" && "bg-primary/10 text-primary",
                    entry.role === "tool" &&
                      "bg-yellow-500/10 italic text-yellow-400",
                  )}
                >
                  <span className="font-medium">
                    {entry.role === "user"
                      ? "You"
                      : entry.role === "gemini"
                        ? aiLabel
                        : "🔧"}
                    :{" "}
                  </span>
                  {entry.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Text Input */}
          {isConnected && (
            <div className="flex gap-2 border-t border-border px-3 py-2">
              <Input
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="h-7 flex-1 text-xs"
              />
              <Button
                onClick={handleSend}
                size="sm"
                className="h-7 gap-1 px-2"
              >
                <Send className="size-3" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
          <AlertCircle className="size-8 text-red-400" />
          <p className="text-sm text-red-400">{statusMessage || "Connection error"}</p>
          <Button variant="outline" size="sm" onClick={onConnect} className="gap-1.5">
            <Mic className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Idle with previous transcript */}
      {isIdle && transcript.length > 0 && (
        <>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-3">
              {transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded px-2.5 py-1.5 text-xs",
                    entry.role === "user" && "bg-blue-500/10 text-blue-400",
                    entry.role === "gemini" && "bg-primary/10 text-primary",
                    entry.role === "tool" &&
                      "bg-yellow-500/10 italic text-yellow-400",
                  )}
                >
                  <span className="font-medium">
                    {entry.role === "user"
                      ? "You"
                      : entry.role === "gemini"
                        ? aiLabel
                        : "🔧"}
                    :{" "}
                  </span>
                  {entry.text}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t border-border px-3 py-2">
            <Button onClick={onConnect} size="sm" className="w-full gap-1.5">
              <Mic className="size-3.5" />
              Test Again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
