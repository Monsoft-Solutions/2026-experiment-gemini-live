import { useCallback, useState } from "react";
import { Mic } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layouts/main-layout";
import { AdminModal } from "@/features/admin/components/admin-modal";
import { CallDetailModal } from "@/features/admin/components/call-detail-modal";
import { useCallHistory } from "@/features/admin/api/use-twilio";
import { TestPanel } from "@/features/conversation/components/test-panel";
import { useConversation } from "@/features/conversation/hooks/use-conversation";
import { useConversationStore } from "@/features/conversation/stores/conversation-store";
import {
  useCreatePersona,
  useDeletePersona,
  usePersonas,
  useUpdatePersona,
} from "@/features/personas/api/use-personas";
import { PersonaModal } from "@/features/personas/components/persona-modal";
import { SessionDetailModal } from "@/features/sessions/components/session-detail-modal";
import { useSessions } from "@/features/sessions/api/use-sessions";
import { PersonaEditor } from "@/features/settings/components/persona-editor";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import { useServerConfig } from "@/hooks/use-server-config";
import type { CallRecord, Persona, Session } from "@/types";

export function App() {
  const config = useServerConfig();
  const providers = config.data?.providers ?? {};
  const { data: personas = [], isLoading: personasLoading } = usePersonas();
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
  const { data: calls = [] } = useCallHistory();
  const queryClient = useQueryClient();

  const activePersonaId = useConversationStore((s) => s.activePersonaId);
  const activePersonaName = useConversationStore((s) => s.activePersonaName);
  const setActivePersona = useConversationStore((s) => s.setActivePersona);
  const connectionStatus = useConversationStore((s) => s.status);
  const settings = useSettingsStore();
  const getSessionConfig = useSettingsStore((s) => s.getSessionConfig);
  const provider = useSettingsStore((s) => s.provider);

  const { connect, disconnect, sendText } = useConversation();

  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const deletePersona = useDeletePersona();

  // Editor state
  const [editorPersonaName, setEditorPersonaName] = useState("");
  const [activeTab, setActiveTab] = useState("configure");

  // Persona modal
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  // Session detail modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Admin modal
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Call detail modal
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const providerName = providers[provider]?.displayName ?? provider;

  // --- Persona handlers ---
  const handleSelectPersona = useCallback(
    (persona: Persona) => {
      setActivePersona(persona._id, persona.name);
      setEditorPersonaName(persona.name);
      settings.loadFromPersona({
        provider: persona.provider,
        voice: persona.voice,
        language: persona.language,
        systemPrompt: persona.systemPrompt,
        affectiveDialog: persona.affectiveDialog,
        proactiveAudio: persona.proactiveAudio,
        googleSearch: persona.googleSearch,
      });
    },
    [setActivePersona, settings],
  );

  const handleEditPersona = useCallback((persona: Persona) => {
    setEditingPersona(persona);
    setPersonaModalOpen(true);
  }, []);

  const handleNewPersona = useCallback(() => {
    setActivePersona(null, null);
    setEditorPersonaName("");
    settings.setSystemPrompt("");
  }, [setActivePersona, settings]);

  const handleSavePersona = useCallback(async () => {
    const name = editorPersonaName.trim();
    if (!name) {
      toast.error("Persona name is required");
      return;
    }

    const data = { name, ...settings.getSessionConfig() };

    try {
      if (activePersonaId) {
        await updatePersona.mutateAsync({ id: activePersonaId, ...data });
        toast.success("Persona updated");
      } else {
        await createPersona.mutateAsync(data);
        toast.success("Persona created");
      }
    } catch (e) {
      toast.error(
        `Failed to save: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }, [editorPersonaName, activePersonaId, settings, createPersona, updatePersona]);

  const handleSavePersonaFromModal = useCallback(
    async (name: string) => {
      const data = { name, ...settings.getSessionConfig() };
      try {
        if (editingPersona) {
          await updatePersona.mutateAsync({ id: editingPersona._id, ...data });
          toast.success("Persona updated");
        } else {
          await createPersona.mutateAsync(data);
          toast.success("Persona created");
        }
        setPersonaModalOpen(false);
      } catch (e) {
        toast.error(
          `Failed to save: ${e instanceof Error ? e.message : "unknown"}`,
        );
      }
    },
    [editingPersona, settings, createPersona, updatePersona],
  );

  const handleDeletePersona = useCallback(async () => {
    if (!editingPersona) return;
    try {
      await deletePersona.mutateAsync(editingPersona._id);
      setPersonaModalOpen(false);
      if (activePersonaId === editingPersona._id) {
        setActivePersona(null, null);
        setEditorPersonaName("");
      }
      toast.success("Persona deleted");
    } catch (e) {
      toast.error(
        `Failed to delete: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }, [editingPersona, deletePersona, activePersonaId, setActivePersona]);

  // --- Test Voice ---
  const handleTestVoice = useCallback(() => {
    const cfg = getSessionConfig();
    connect(cfg, activePersonaName ?? (editorPersonaName || null), () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    });
  }, [connect, getSessionConfig, activePersonaName, editorPersonaName, queryClient]);

  // --- Session handlers ---
  const handleSelectSession = useCallback((session: Session) => {
    setSelectedSessionId(session._id);
    setSessionModalOpen(true);
  }, []);

  // --- Call handlers ---
  const handleSelectCall = useCallback((call: CallRecord) => {
    setSelectedCallId(call._id);
    setCallModalOpen(true);
  }, []);

  // Start test and switch to test tab
  const handleStartTest = useCallback(() => {
    setActiveTab("test");
    handleTestVoice();
  }, [handleTestVoice]);

  return (
    <>
      <MainLayout
        personas={personas}
        personasLoading={personasLoading}
        activePersonaId={activePersonaId}
        sessions={sessions}
        calls={calls}
        sessionsLoading={sessionsLoading}
        onSelectPersona={handleSelectPersona}
        onEditPersona={handleEditPersona}
        onNewPersona={handleNewPersona}
        onSelectSession={handleSelectSession}
        onSelectCall={handleSelectCall}
        onOpenAdmin={() => setAdminModalOpen(true)}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="configure" className="flex-1">
              Configure
            </TabsTrigger>
            <TabsTrigger value="test" className="flex-1">
              Test
              {connectionStatus === "connected" && (
                <span className="ml-1.5 size-2 rounded-full bg-primary motion-safe:animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="mt-0 flex-1">
            <PersonaEditor
              personaName={editorPersonaName}
              onPersonaNameChange={setEditorPersonaName}
              onSave={handleSavePersona}
              isSaving={createPersona.isPending || updatePersona.isPending}
            />
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={handleStartTest}
                className="gap-2"
              >
                <Mic className="size-4" />
                Test Voice →
              </Button>
            </div>
          </TabsContent>

          <TabsContent
            value="test"
            className="mt-0 flex flex-1 flex-col rounded-lg border border-border bg-card shadow-sm dark:shadow-black/20"
          >
            <TestPanel
              providerName={providerName}
              onConnect={handleTestVoice}
              onDisconnect={disconnect}
              onSendText={sendText}
            />
          </TabsContent>
        </Tabs>
      </MainLayout>

      {/* Modals */}
      <PersonaModal
        open={personaModalOpen}
        onOpenChange={setPersonaModalOpen}
        persona={editingPersona}
        onSave={handleSavePersonaFromModal}
        onDelete={handleDeletePersona}
      />

      <SessionDetailModal
        sessionId={selectedSessionId}
        open={sessionModalOpen}
        onOpenChange={setSessionModalOpen}
        providers={providers}
      />

      <AdminModal
        open={adminModalOpen}
        onOpenChange={setAdminModalOpen}
        personas={personas}
      />

      <CallDetailModal
        callId={selectedCallId}
        open={callModalOpen}
        onOpenChange={setCallModalOpen}
      />
    </>
  );
}
