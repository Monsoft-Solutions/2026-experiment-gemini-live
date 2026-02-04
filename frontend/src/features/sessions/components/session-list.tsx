import type { Session, ProviderConfig } from "@/types";

interface SessionListProps {
  sessions: Session[];
  providers: Record<string, ProviderConfig>;
  onSelect: (session: Session) => void;
}

export function SessionList({
  sessions,
  providers: _providers,
  onSelect,
}: SessionListProps) {
  void _providers; // used by parent for future provider labels
  if (sessions.length === 0) {
    return (
      <p className="px-2 text-xs text-muted-foreground">No sessions yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
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
            onClick={() => onSelect(s)}
            className="flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="truncate">{label}</span>
            <span className="ml-2 shrink-0 text-[10px] text-muted-foreground/60">
              {date.toLocaleDateString()} · {dur}
            </span>
          </button>
        );
      })}
    </div>
  );
}
