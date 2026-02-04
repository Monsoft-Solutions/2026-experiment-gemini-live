import { Mic } from "lucide-react";

export function WelcomeHero() {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Mic className="size-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Real-time voice conversations
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Powered by AI. Configure your settings below, choose a persona from
          the sidebar, and press Connect to start talking.
        </p>
      </div>
    </div>
  );
}
