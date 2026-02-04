import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import { useServerConfig } from "@/hooks/use-server-config";
import { useConversationStore } from "../stores/conversation-store";
import { useConversation } from "../hooks/use-conversation";
import { ActiveSessionInfo } from "./active-session-info";
import { ConnectionStatus } from "./connection-status";
import { TalkButton } from "./talk-button";
import { TextInput } from "./text-input";
import { TranscriptPanel } from "./transcript-panel";
import { WelcomeHero } from "./welcome-hero";

interface ConversationViewProps {
  onSavePersona: () => void;
  onSessionEnd: () => void;
}

export function ConversationView({
  onSavePersona,
  onSessionEnd,
}: ConversationViewProps) {
  const status = useConversationStore((s) => s.status);
  const activePersonaName = useConversationStore((s) => s.activePersonaName);
  const getSessionConfig = useSettingsStore((s) => s.getSessionConfig);
  const provider = useSettingsStore((s) => s.provider);
  const config = useServerConfig();
  const { connect, disconnect, sendText } = useConversation();

  const isConnected = status === "connected";
  const isIdle = status === "idle";
  const providers = config.data?.providers ?? {};
  const providerName = providers[provider]?.displayName ?? provider;

  const handleConnect = useCallback(() => {
    const cfg = getSessionConfig();
    connect(cfg, activePersonaName, onSessionEnd);
  }, [connect, getSessionConfig, activePersonaName, onSessionEnd]);

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* Welcome hero — only visible on idle with no transcript history */}
      {isIdle && (
        <div className="transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
          <WelcomeHero />
        </div>
      )}

      {/* Connected state: active session info */}
      {isConnected && (
        <div className="mb-4 transition-all duration-300 animate-in fade-in">
          <ActiveSessionInfo
            personaName={activePersonaName}
            providerName={providerName}
            isConnected={isConnected}
          />
        </div>
      )}

      {/* Talk button + status — always visible */}
      <div
        className={cn(
          "flex flex-col items-center transition-all duration-500",
          isConnected && "py-2",
        )}
      >
        <TalkButton onConnect={handleConnect} onDisconnect={disconnect} />
        <ConnectionStatus />
      </div>

      {/* Text input — connected only */}
      {isConnected && (
        <div className="w-full max-w-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
          <TextInput onSend={sendText} />
        </div>
      )}

      {/* Save Persona button — visible when idle */}
      {isIdle && (
        <div className="mt-3 transition-all duration-300 animate-in fade-in">
          <Button
            variant="outline"
            size="sm"
            onClick={onSavePersona}
            className="gap-1.5"
          >
            <Save className="size-3.5" />
            Save Persona
          </Button>
        </div>
      )}

      {/* Transcript — fills remaining space */}
      <div className="mt-2 flex w-full flex-1 flex-col">
        <TranscriptPanel providerName={providerName} />
      </div>
    </div>
  );
}
