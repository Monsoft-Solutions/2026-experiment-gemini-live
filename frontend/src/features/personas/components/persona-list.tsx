import { cn } from "@/lib/utils";
import type { Persona, ProviderConfig } from "@/types";

interface PersonaListProps {
  personas: Persona[];
  activeId: string | null;
  providers: Record<string, ProviderConfig>;
  onSelect: (persona: Persona) => void;
  onDoubleClick: (persona: Persona) => void;
}

export function PersonaList({
  personas,
  activeId,
  providers,
  onSelect,
  onDoubleClick,
}: PersonaListProps) {
  if (personas.length === 0) {
    return (
      <p className="px-2 text-xs text-muted-foreground">No personas yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5" role="listbox" aria-label="Persona list">
      {personas.map((p) => {
        const providerLabel = p.provider
          ? (providers[p.provider]?.displayName ?? p.provider)
          : "";
        const meta = providerLabel ? `${providerLabel} · ${p.voice}` : p.voice;

        return (
          <button
            key={p._id}
            role="option"
            aria-selected={activeId === p._id}
            onClick={() => onSelect(p)}
            onDoubleClick={() => onDoubleClick(p)}
            className={cn(
              "flex min-h-[44px] items-center justify-between rounded-md px-2.5 py-2.5 text-left text-sm transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              activeId === p._id && "bg-green-500/10 text-green-400",
            )}
          >
            <span className="truncate">{p.name}</span>
            <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
              {meta}
            </span>
          </button>
        );
      })}
    </div>
  );
}
