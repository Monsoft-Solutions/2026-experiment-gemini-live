import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ProviderConfig } from "@/types";
import { useSession, useSessionMessages } from "../api/use-sessions";

interface SessionDetailModalProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Record<string, ProviderConfig>;
}

export function SessionDetailModal({
  sessionId,
  open,
  onOpenChange,
  providers,
}: SessionDetailModalProps) {
  const { data: session } = useSession(sessionId);
  const { data: messages } = useSessionMessages(sessionId);

  if (!session) return null;

  const date = new Date(session.startedAt);
  const dur = session.duration
    ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s`
    : "ongoing";
  const providerName = session.settings.provider
    ? (providers[session.settings.provider]?.displayName ??
        session.settings.provider)
    : "Gemini";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg">
        <DialogHeader>
          <DialogTitle>{session.personaName ?? "Session"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            <strong>Date:</strong> {date.toLocaleString()}
          </p>
          <p>
            <strong>Duration:</strong> {dur}
          </p>
          <p>
            <strong>Provider:</strong> {providerName} · <strong>Voice:</strong>{" "}
            {session.settings.voice} · <strong>Language:</strong>{" "}
            {session.settings.language}
          </p>
          {session.settings.systemPrompt && (
            <p>
              <strong>Prompt:</strong>{" "}
              {session.settings.systemPrompt.slice(0, 100)}...
            </p>
          )}
        </div>

        <ScrollArea className="mt-2 max-h-[400px]">
          <div className="space-y-1.5">
            {(!messages || messages.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No transcript recorded
              </p>
            )}
            {messages?.map((m) => (
              <div
                key={m._id}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  m.role === "user" && "text-blue-400",
                  m.role === "gemini" && "text-green-400",
                )}
              >
                {m.role === "user" ? "You" : providerName}: {m.text}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
