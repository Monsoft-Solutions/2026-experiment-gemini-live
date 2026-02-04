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
    <button
      onClick={isConnected ? onDisconnect : onConnect}
      disabled={isConnecting}
      aria-label={ariaLabel}
      className={cn(
        "size-[100px] rounded-full border-[3px] text-sm font-semibold transition-all duration-300",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
        isConnected
          ? "border-red-500 bg-red-500/10 text-red-400 motion-safe:animate-pulse"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
      )}
    >
      {isConnected ? "Disconnect" : isConnecting ? "..." : "Connect"}
    </button>
  );
}
