import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

interface ConversationTimerProps {
  active: boolean;
}

export function ConversationTimer({ active }: ConversationTimerProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-muted-foreground">
      <Timer className="size-3.5" />
      {display}
    </div>
  );
}
