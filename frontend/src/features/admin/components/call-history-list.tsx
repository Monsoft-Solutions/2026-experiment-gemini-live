import { Phone } from "lucide-react";
import type { CallRecord } from "@/types";

interface CallHistoryListProps {
  calls: CallRecord[];
  onSelect: (call: CallRecord) => void;
}

export function CallHistoryList({ calls, onSelect }: CallHistoryListProps) {
  if (calls.length === 0) {
    return (
      <p className="px-2 text-xs text-muted-foreground">No calls yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {calls.map((c) => {
        const date = new Date(c.startedAt);
        const dur = c.duration
          ? `${Math.floor(c.duration / 60)}m${c.duration % 60}s`
          : c.status;
        const label = c.personaName ?? c.to;

        return (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Phone className="size-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{c.from}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground/60">
              {label} · {date.toLocaleDateString()} · {dur}
            </span>
          </button>
        );
      })}
    </div>
  );
}
