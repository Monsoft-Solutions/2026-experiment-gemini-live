import { useState } from "react";
import { Menu, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useServerConfig } from "@/hooks/use-server-config";
import { useConversationStore } from "@/features/conversation/stores/conversation-store";
import { cn } from "@/lib/utils";
import type { CallRecord, Persona, Session } from "@/types";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  personas: Persona[];
  personasLoading?: boolean;
  activePersonaId: string | null;
  sessions: Session[];
  calls: CallRecord[];
  sessionsLoading?: boolean;
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
  personasLoading,
  activePersonaId,
  sessions,
  calls,
  sessionsLoading,
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
  const connectionStatus = useConversationStore((s) => s.status);
  const isConnected = connectionStatus === "connected";

  const sidebarContent = (
    <Sidebar
      personas={personas}
      personasLoading={personasLoading}
      activePersonaId={activePersonaId}
      providers={providers}
      sessions={sessions}
      calls={calls}
      sessionsLoading={sessionsLoading}
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
        <div
          className={cn(
            "sticky top-0 z-10 border-b px-4 py-3 backdrop-blur-sm transition-colors duration-500",
            isConnected
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-background/80",
          )}
        >
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
              <Mic
                className={cn(
                  "size-4 transition-colors duration-500",
                  isConnected ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <h1 className="text-lg font-semibold">Gemini Live</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {config.data?.model && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {config.data.model}
                </span>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
