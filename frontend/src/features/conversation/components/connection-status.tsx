import { Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversationStore } from "../stores/conversation-store";

export function ConnectionStatus() {
  const status = useConversationStore((s) => s.status);
  const message = useConversationStore((s) => s.statusMessage);

  const Icon =
    status === "connected"
      ? Wifi
      : status === "connecting"
        ? Loader2
        : status === "error"
          ? AlertCircle
          : WifiOff;

  return (
    <div aria-live="polite" aria-atomic="true" className="mt-4 min-h-[1.5rem]">
      {message && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300",
            status === "error" && "bg-red-500/10 text-red-400",
            status === "connected" && "bg-primary/10 text-primary",
            status === "connecting" && "bg-muted text-muted-foreground",
            status === "idle" && "text-muted-foreground",
          )}
        >
          <Icon
            className={cn(
              "size-3.5",
              status === "connecting" && "animate-spin",
            )}
          />
          {message}
        </div>
      )}
    </div>
  );
}
