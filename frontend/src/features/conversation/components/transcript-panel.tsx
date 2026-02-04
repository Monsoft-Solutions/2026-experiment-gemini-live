import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConversationStore } from "../stores/conversation-store";

interface TranscriptPanelProps {
  providerName?: string;
}

export function TranscriptPanel({ providerName }: TranscriptPanelProps) {
  const transcript = useConversationStore((s) => s.transcript);
  const status = useConversationStore((s) => s.status);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isConnected = status === "connected";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Empty state while connected
  if (transcript.length === 0 && isConnected) {
    return (
      <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <MessageSquare className="size-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Listening... your conversation will appear here
        </p>
      </div>
    );
  }

  if (transcript.length === 0) return null;

  const aiLabel = providerName || "AI";

  return (
    <ScrollArea className="mt-4 flex-1 rounded-lg border border-border">
      <div
        role="log"
        aria-label="Conversation transcript"
        aria-live="polite"
        className="space-y-1.5 p-3"
      >
        {transcript.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-all duration-200",
              entry.role === "user" && "bg-blue-500/10 text-blue-400",
              entry.role === "gemini" && "bg-primary/10 text-primary",
              entry.role === "tool" &&
                "bg-yellow-500/10 text-xs italic text-yellow-400",
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
  );
}
