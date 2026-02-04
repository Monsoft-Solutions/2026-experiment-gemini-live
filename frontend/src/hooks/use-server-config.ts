import { useQuery } from "@tanstack/react-query";
import { getServerConfig } from "@/lib/api-client";

export function useServerConfig() {
  return useQuery({
    queryKey: ["server-config"],
    queryFn: getServerConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
