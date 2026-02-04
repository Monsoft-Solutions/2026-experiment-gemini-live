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

  return (
    <button
      onClick={isConnected ? onDisconnect : onConnect}
      disabled={isConnecting}
      className={cn(
        "size-[100px] rounded-full border-[3px] text-sm font-semibold transition-all duration-300",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
        isConnected
          ? "animate-pulse border-red-500 bg-red-500/10 text-red-400"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
      )}
    >
      {isConnected ? "Disconnect" : isConnecting ? "..." : "Connect"}
    </button>
  );
}
