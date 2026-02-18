import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCallStatus,
  hangupCall,
  placeOutboundCall,
  type OutboundCallRequest,
} from "@/lib/api-client";

export function usePlaceCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OutboundCallRequest) => placeOutboundCall(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-history"] });
    },
  });
}

export function useHangupCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callSid: string) => hangupCall(callSid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-history"] });
    },
  });
}

export function useCallStatus(callSid: string | null, enabled = false) {
  return useQuery({
    queryKey: ["call-status", callSid],
    queryFn: () => getCallStatus(callSid!),
    enabled: !!callSid && enabled,
    refetchInterval: 2000, // Poll every 2s while active
  });
}
