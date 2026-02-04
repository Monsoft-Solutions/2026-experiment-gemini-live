import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConversationStore } from "../stores/conversation-store";

export function TranscriptPanel() {
  const transcript = useConversationStore((s) => s.transcript);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  if (transcript.length === 0) return null;

  return (
    <ScrollArea className="mt-4 max-h-[300px] w-full rounded-lg border border-border">
      <div className="space-y-1.5 p-3">
        {transcript.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              entry.role === "user" && "bg-blue-500/10 text-blue-400",
              entry.role === "gemini" && "bg-green-500/10 text-green-400",
              entry.role === "tool" && "bg-yellow-500/10 text-yellow-400 text-xs italic",
            )}
          >
            <span className="font-medium">
              {entry.role === "user"
                ? "You"
                : entry.role === "gemini"
                  ? "AI"
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
