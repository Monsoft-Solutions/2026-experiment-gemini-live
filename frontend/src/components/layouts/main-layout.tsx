import { useState } from "react";
import { Menu, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useServerConfig } from "@/hooks/use-server-config";
import type { Persona, Session } from "@/types";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  personas: Persona[];
  activePersonaId: string | null;
  sessions: Session[];
  onSelectPersona: (persona: Persona) => void;
  onEditPersona: (persona: Persona) => void;
  onNewPersona: () => void;
  onSelectSession: (session: Session) => void;
  onOpenAdmin: () => void;
  children: React.ReactNode;
}

export function MainLayout({
  personas,
  activePersonaId,
  sessions,
  onSelectPersona,
  onEditPersona,
  onNewPersona,
  onSelectSession,
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
      onSelectPersona={onSelectPersona}
      onEditPersona={onEditPersona}
      onNewPersona={onNewPersona}
      onSelectSession={onSelectSession}
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
      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-xl items-center">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2 md:hidden"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-primary" />
              <h1 className="text-lg font-semibold">Gemini Live</h1>
            </div>
            {config.data?.model && (
              <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">
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
