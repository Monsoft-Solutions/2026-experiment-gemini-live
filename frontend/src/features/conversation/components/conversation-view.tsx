import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import { useConversationStore } from "../stores/conversation-store";
import { useConversation } from "../hooks/use-conversation";
import { ConnectionStatus } from "./connection-status";
import { TalkButton } from "./talk-button";
import { TextInput } from "./text-input";
import { TranscriptPanel } from "./transcript-panel";

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
  const { connect, disconnect, sendText } = useConversation();
  const isConnected = status === "connected";

  const handleConnect = useCallback(() => {
    const config = getSessionConfig();
    connect(config, activePersonaName, onSessionEnd);
  }, [connect, getSessionConfig, activePersonaName, onSessionEnd]);

  return (
    <div className="flex w-full flex-col items-center">
      {/* Controls */}
      <div className="flex flex-col items-center">
        <TalkButton onConnect={handleConnect} onDisconnect={disconnect} />
        <ConnectionStatus />
        {isConnected && <TextInput onSend={sendText} />}
      </div>

      {/* Save Persona button — visible when not connected */}
      {!isConnected && (
        <div className="mt-3">
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

      {/* Transcript */}
      <TranscriptPanel />
    </div>
  );
}
