import { cn } from "@/lib/utils";
import { useConversationStore } from "../stores/conversation-store";

export function ConnectionStatus() {
  const status = useConversationStore((s) => s.status);
  const message = useConversationStore((s) => s.statusMessage);

  if (!message) return null;

  return (
    <p
      className={cn(
        "mt-3 text-center text-xs",
        status === "error" && "text-red-400",
        status === "connected" && "text-green-400",
        (status === "idle" || status === "connecting") && "text-muted-foreground",
      )}
    >
      {message}
    </p>
  );
}
