import { useState } from "react";
import { Menu, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useServerConfig } from "@/hooks/use-server-config";
import type { CallRecord, Persona, Session } from "@/types";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  personas: Persona[];
  activePersonaId: string | null;
  sessions: Session[];
  calls: CallRecord[];
  onSelectPersona: (persona: Persona) => void;
  onEditPersona: (persona: Persona) => void;
  onNewPersona: () => void;
  onSelectSession: (session: Session) => void;
  onSelectCall: (call: CallRecord) => void;
  onOpenAdmin: () => void;
  children: React.ReactNode;
}

export function MainLayout({
  personas,
  activePersonaId,
  sessions,
  calls,
  onSelectPersona,
  onEditPersona,
  onNewPersona,
  onSelectSession,
  onSelectCall,
  onOpenAdmin,
  children,
}: MainLayoutProps) {
  const config = useServerConfig();
  const providers = config.data?.providers ?? {};
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <Sidebar
      personas={personas}
      activePersonaId={activePersonaId}
      providers={providers}
      sessions={sessions}
      calls={calls}
      onSelectPersona={onSelectPersona}
      onEditPersona={onEditPersona}
      onNewPersona={onNewPersona}
      onSelectSession={onSelectSession}
      onSelectCall={onSelectCall}
      onOpenAdmin={onOpenAdmin}
    />
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebarContent}</div>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-y-auto" aria-label="Conversation area">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-xl items-center">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2 min-h-[44px] min-w-[44px] md:hidden"
                  aria-label="Open sidebar menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-primary" aria-hidden="true" />
              <h1 className="text-lg font-semibold">Gemini Live</h1>
            </div>
            {config.data?.model && (
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                {config.data.model}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
