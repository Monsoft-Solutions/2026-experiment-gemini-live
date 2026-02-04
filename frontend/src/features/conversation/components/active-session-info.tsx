import { Badge } from "@/components/ui/badge";
import { ConversationTimer } from "./conversation-timer";

interface ActiveSessionInfoProps {
  personaName: string | null;
  providerName: string | null;
  isConnected: boolean;
}

export function ActiveSessionInfo({
  personaName,
  providerName,
  isConnected,
}: ActiveSessionInfoProps) {
  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-3">
      {personaName && (
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
          {personaName}
        </Badge>
      )}
      {providerName && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {providerName}
        </Badge>
      )}
      <ConversationTimer active={isConnected} />
    </div>
  );
}
