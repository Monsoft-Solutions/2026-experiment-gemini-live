import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversationStore } from "../stores/conversation-store";

interface TalkButtonProps {
  onConnect: () => void;
  onDisconnect: () => void;
}

export function TalkButton({ onConnect, onDisconnect }: TalkButtonProps) {
  const status = useConversationStore((s) => s.status);
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const ariaLabel = isConnected
    ? "Disconnect from voice conversation"
    : isConnecting
      ? "Connecting to voice conversation"
      : "Connect to voice conversation";

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulsing ring when connected */}
      {isConnected && (
        <div className="absolute size-[120px] rounded-full border-2 border-primary/40 motion-safe:animate-ping" />
      )}
      {/* Glow ring when connected */}
      {isConnected && (
        <div className="absolute size-[110px] rounded-full bg-primary/10 motion-safe:animate-pulse" />
      )}
      <button
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isConnecting}
        aria-label={ariaLabel}
        className={cn(
          "relative z-10 flex size-[100px] items-center justify-center rounded-full border-[3px] text-sm font-semibold transition-all duration-500",
          "cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
          isConnected
            ? "border-red-500 bg-red-500/10 text-red-400 shadow-lg shadow-red-500/20 hover:bg-red-500/20"
            : isConnecting
              ? "border-primary/50 bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary hover:shadow-lg hover:shadow-primary/10",
        )}
      >
        {isConnecting ? (
          <Loader2 className="size-6 animate-spin" />
        ) : isConnected ? (
          "Disconnect"
        ) : (
          "Connect"
        )}
      </button>
    </div>
  );
}
