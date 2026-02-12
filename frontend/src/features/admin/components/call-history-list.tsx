import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
        const isOutbound = c.direction === "outbound";
        const DirectionIcon = isOutbound ? ArrowUpRight : ArrowDownLeft;
        const displayNumber = isOutbound ? c.to : c.from;

        return (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            className="flex min-h-[40px] items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
          >
            <DirectionIcon
              className={cn(
                "size-3 shrink-0",
                isOutbound ? "text-primary/60" : "text-green-500/60",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[11px]">
                {displayNumber}
              </p>
              {c.personaName && (
                <p className="truncate text-[10px] text-muted-foreground/60">
                  {c.personaName}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[9px] text-muted-foreground/50">
              {date.toLocaleDateString()} · {dur}
            </span>
          </button>
        );
      })}
    </div>
  );
}
