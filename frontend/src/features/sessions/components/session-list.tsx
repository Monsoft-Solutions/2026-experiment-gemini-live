import { Clock } from "lucide-react";
import { SessionListSkeleton } from "@/components/shared/skeletons";
import type { Session, ProviderConfig } from "@/types";

interface SessionListProps {
  sessions: Session[];
  loading?: boolean;
  providers: Record<string, ProviderConfig>;
  onSelect: (session: Session) => void;
}

export function SessionList({
  sessions,
  loading,
  providers: _providers,
  onSelect,
}: SessionListProps) {
  void _providers;

  if (loading) {
    return <SessionListSkeleton />;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Clock className="size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          Your conversation history will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5" role="list" aria-label="Session history">
      {sessions.map((s) => {
        const date = new Date(s.startedAt);
        const provTag =
          s.settings.provider && s.settings.provider !== "gemini"
            ? `[${s.settings.provider}] `
            : "";
        const label = provTag + (s.personaName ?? s.settings.voice);
        const dur = s.duration
          ? `${Math.floor(s.duration / 60)}m${s.duration % 60}s`
          : "active";

        return (
          <button
            key={s._id}
            role="listitem"
            onClick={() => onSelect(s)}
            className="flex min-h-[44px] items-center justify-between rounded-md px-2.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="truncate">{label}</span>
            <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
              {date.toLocaleDateString()} · {dur}
            </span>
          </button>
        );
      })}
    </div>
  );
}
