import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@/lib/convex";
import type { Session, SessionMessage } from "@/types";

export function useSessions(limit = 30) {
  return useQuery({
    queryKey: ["sessions", limit],
    queryFn: () => convexQuery<Session[]>("sessions:list", { limit }),
  });
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => convexQuery<Session>("sessions:get", { id: id! }),
    enabled: !!id,
  });
}

export function useSessionMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ["session-messages", sessionId],
    queryFn: () =>
      convexQuery<SessionMessage[]>("sessions:getMessages", {
        sessionId: sessionId!,
      }),
    enabled: !!sessionId,
  });
}
