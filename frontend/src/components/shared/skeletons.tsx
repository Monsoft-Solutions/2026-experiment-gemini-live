import { Skeleton } from "@/components/ui/skeleton";

export function SettingsPanelSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Provider */}
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
        {/* Voice */}
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-9 w-full" />
        </div>
        {/* Language */}
        <div className="space-y-1.5 sm:col-span-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      {/* System Prompt */}
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-[72px] w-full" />
      </div>
      {/* Toggles */}
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
    </div>
  );
}

export function PersonaListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex min-h-[44px] items-center justify-between rounded-md px-2.5 py-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SessionListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex min-h-[44px] items-center justify-between rounded-md px-2.5 py-2.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
