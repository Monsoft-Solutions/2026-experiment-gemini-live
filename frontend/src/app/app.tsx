import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MainLayout } from "@/components/layouts/main-layout";
import { AdminModal } from "@/features/admin/components/admin-modal";
import { CallDetailModal } from "@/features/admin/components/call-detail-modal";
import { useCallHistory } from "@/features/admin/api/use-twilio";
import { ConversationView } from "@/features/conversation/components/conversation-view";
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
import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import { useServerConfig } from "@/hooks/use-server-config";
import type { CallRecord, Persona, Session } from "@/types";

export function App() {
  const config = useServerConfig();
  const providers = config.data?.providers ?? {};
  const { data: personas = [] } = usePersonas();
  const { data: sessions = [] } = useSessions();
  const { data: calls = [] } = useCallHistory();
  const queryClient = useQueryClient();

  const activePersonaId = useConversationStore((s) => s.activePersonaId);
  const setActivePersona = useConversationStore((s) => s.setActivePersona);
  const connectionStatus = useConversationStore((s) => s.status);
  const settings = useSettingsStore();

  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const deletePersona = useDeletePersona();

  // Persona modal
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  // Session detail modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  // Admin modal
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Call detail modal
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  // --- Persona handlers ---
  const handleSelectPersona = useCallback(
    (persona: Persona) => {
      setActivePersona(persona._id, persona.name);
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
    if (activePersonaId) {
      const active = personas.find((p) => p._id === activePersonaId);
      if (active) {
        setEditingPersona(active);
        setPersonaModalOpen(true);
        return;
      }
    }
    setEditingPersona(null);
    setPersonaModalOpen(true);
  }, [activePersonaId, personas]);

  const handleSavePersona = useCallback(
    async (name: string) => {
      const data = {
        name,
        ...settings.getSessionConfig(),
      };

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
          `Failed to save persona: ${e instanceof Error ? e.message : "unknown"}`,
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
      toast.success("Persona deleted");
    } catch (e) {
      toast.error(
        `Failed to delete: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }, [editingPersona, deletePersona]);

  // --- Session handlers ---
  const handleSelectSession = useCallback((session: Session) => {
    setSelectedSessionId(session._id);
    setSessionModalOpen(true);
  }, []);

  const handleSessionEnd = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  }, [queryClient]);

  // --- Call handlers ---
  const handleSelectCall = useCallback((call: CallRecord) => {
    setSelectedCallId(call._id);
    setCallModalOpen(true);
  }, []);

  // --- Admin ---
  const handleOpenAdmin = useCallback(() => {
    setAdminModalOpen(true);
  }, []);

  const isConnected = connectionStatus === "connected";

  return (
    <>
      <MainLayout
        personas={personas}
        activePersonaId={activePersonaId}
        sessions={sessions}
        calls={calls}
        onSelectPersona={handleSelectPersona}
        onEditPersona={handleEditPersona}
        onNewPersona={handleNewPersona}
        onSelectSession={handleSelectSession}
        onSelectCall={handleSelectCall}
        onOpenAdmin={handleOpenAdmin}
      >
        {/* Settings — hidden when connected */}
        {!isConnected && <SettingsPanel />}

        {/* Conversation */}
        <ConversationView
          onSavePersona={handleNewPersona}
          onSessionEnd={handleSessionEnd}
        />
      </MainLayout>

      {/* Modals */}
      <PersonaModal
        open={personaModalOpen}
        onOpenChange={setPersonaModalOpen}
        persona={editingPersona}
        onSave={handleSavePersona}
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
