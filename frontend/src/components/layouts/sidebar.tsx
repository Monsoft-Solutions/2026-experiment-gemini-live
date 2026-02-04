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
  personasLoading?: boolean;
  activePersonaId: string | null;
  providers: Record<string, ProviderConfig>;
  sessions: Session[];
  sessionsLoading?: boolean;
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
  personasLoading,
  activePersonaId,
  providers,
  sessions,
  sessionsLoading,
  calls,
  onSelectPersona,
  onEditPersona,
  onNewPersona,
  onSelectSession,
  onSelectCall,
  onOpenAdmin,
}: SidebarProps) {
  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-border bg-card"
      aria-label="Sidebar navigation"
    >
      <ScrollArea className="flex-1">
        {/* Personas */}
        <nav className="p-3" aria-label="Personas">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Personas
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 min-h-[44px] min-w-[44px]"
              onClick={onNewPersona}
              aria-label="Create new persona"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <PersonaList
            personas={personas}
            loading={personasLoading}
            activeId={activePersonaId}
            providers={providers}
            onSelect={onSelectPersona}
            onDoubleClick={onEditPersona}
          />
        </nav>

        <Separator />

        {/* History */}
        <nav className="p-3" aria-label="Session history">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </h3>
          <SessionList
            sessions={sessions}
            loading={sessionsLoading}
            providers={providers}
            onSelect={onSelectSession}
          />
        </nav>

        <Separator />

        {/* Phone Calls */}
        <nav className="p-3" aria-label="Phone calls">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            📞 Phone Calls
          </h3>
          <CallHistoryList calls={calls} onSelect={onSelectCall} />
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenAdmin}
          className="min-h-[44px] w-full justify-start gap-2 text-muted-foreground"
          aria-label="Open admin settings"
        >
          <Settings className="size-4" />
          Admin
        </Button>
      </div>
    </aside>
  );
}
