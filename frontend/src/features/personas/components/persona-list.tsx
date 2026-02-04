import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonaListSkeleton } from "@/components/shared/skeletons";
import type { Persona, ProviderConfig } from "@/types";

interface PersonaListProps {
  personas: Persona[];
  loading?: boolean;
  activeId: string | null;
  providers: Record<string, ProviderConfig>;
  onSelect: (persona: Persona) => void;
  onDoubleClick: (persona: Persona) => void;
}

export function PersonaList({
  personas,
  loading,
  activeId,
  providers,
  onSelect,
  onDoubleClick,
}: PersonaListProps) {
  if (loading) {
    return <PersonaListSkeleton />;
  }

  if (personas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <UserPlus className="size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          Create your first persona to get started
        </p>
      </div>
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
              activeId === p._id && "bg-primary/10 text-primary",
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
