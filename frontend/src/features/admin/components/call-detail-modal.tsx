import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCallDetail } from "../api/use-twilio";

interface CallDetailModalProps {
  callId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetailModal({
  callId,
  open,
  onOpenChange,
}: CallDetailModalProps) {
  const { data } = useCallDetail(callId);

  if (!data) return null;

  const { call, messages } = data;
  const date = new Date(call.startedAt);
  const dur = call.duration
    ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
    : call.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg">
        <DialogHeader>
          <DialogTitle>Call from {call.from}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            <strong>Date:</strong> {date.toLocaleString()}
          </p>
          <p>
            <strong>Duration:</strong> {dur}
          </p>
          <p>
            <strong>To:</strong> {call.to} · <strong>Status:</strong>{" "}
            {call.status}
          </p>
          <p>
            <strong>Agent:</strong> {call.personaName ?? "—"} (
            {call.provider ?? "—"})
          </p>
          {call.transcript && (
            <p>
              <strong>Transcript:</strong>{" "}
              <em className="text-foreground/70">{call.transcript}</em>
            </p>
          )}
        </div>

        <ScrollArea className="mt-2 max-h-[400px]">
          <div className="space-y-1.5">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No turn-by-turn transcript
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  m.role === "caller" && "text-yellow-400",
                  m.role === "agent" && "text-green-400",
                )}
              >
                {m.role === "caller" ? "📞 Caller" : "🤖 Agent"}: {m.text}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
