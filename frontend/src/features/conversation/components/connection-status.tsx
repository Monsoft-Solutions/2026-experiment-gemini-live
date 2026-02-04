import { cn } from "@/lib/utils";
import { useConversationStore } from "../stores/conversation-store";

export function ConnectionStatus() {
  const status = useConversationStore((s) => s.status);
  const message = useConversationStore((s) => s.statusMessage);

  return (
    <div aria-live="polite" aria-atomic="true" className="mt-3 min-h-[1.25rem]">
      {message && (
        <p
          className={cn(
            "text-center text-xs",
            status === "error" && "text-red-400",
            status === "connected" && "text-green-400",
            (status === "idle" || status === "connecting") &&
              "text-muted-foreground",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
