import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { CallRecord, Persona, ProviderConfig, Session } from "@/types";
import { CallHistoryList } from "@/features/admin/components/call-history-list";
import { PersonaList } from "@/features/personas/components/persona-list";
import { SessionList } from "@/features/sessions/components/session-list";

interface SidebarProps {
  personas: Persona[];
  activePersonaId: string | null;
  providers: Record<string, ProviderConfig>;
  sessions: Session[];
  calls: CallRecord[];
  onSelectPersona: (persona: Persona) => void;
  onEditPersona: (persona: Persona) => void;
  onNewPersona: () => void;
  onSelectSession: (session: Session) => void;
  onSelectCall: (call: CallRecord) => void;
  onOpenAdmin: () => void;
}

export function Sidebar({
  personas,
  activePersonaId,
  providers,
  sessions,
  calls,
  onSelectPersona,
  onEditPersona,
  onNewPersona,
  onSelectSession,
  onSelectCall,
  onOpenAdmin,
}: SidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <ScrollArea className="flex-1">
        {/* Personas */}
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Personas
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={onNewPersona}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <PersonaList
            personas={personas}
            activeId={activePersonaId}
            providers={providers}
            onSelect={onSelectPersona}
            onDoubleClick={onEditPersona}
          />
        </div>

        <Separator />

        {/* History */}
        <div className="p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </h3>
          <SessionList
            sessions={sessions}
            providers={providers}
            onSelect={onSelectSession}
          />
        </div>

        <Separator />

        {/* Phone Calls */}
        <div className="p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            📞 Phone Calls
          </h3>
          <CallHistoryList calls={calls} onSelect={onSelectCall} />
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenAdmin}
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <Settings className="size-3.5" />
          Admin
        </Button>
      </div>
    </aside>
  );
}
