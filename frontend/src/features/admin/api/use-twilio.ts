import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCallDetail,
  getCallHistory,
  getPhoneNumbers,
  getTwilioConfig,
  linkPhoneNumber,
  saveTwilioConfig,
  unlinkPhoneNumber,
} from "@/lib/api-client";

export function useTwilioConfig() {
  return useQuery({
    queryKey: ["twilio-config"],
    queryFn: getTwilioConfig,
    retry: false,
  });
}

export function useSaveTwilioConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveTwilioConfig,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["twilio-config"] }),
  });
}

export function usePhoneNumbers() {
  return useQuery({
    queryKey: ["phone-numbers"],
    queryFn: getPhoneNumbers,
    retry: false,
  });
}

export function useLinkPhoneNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: linkPhoneNumber,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["phone-numbers"] }),
  });
}

export function useUnlinkPhoneNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkPhoneNumber,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["phone-numbers"] }),
  });
}

export function useCallHistory(limit = 20) {
  return useQuery({
    queryKey: ["call-history", limit],
    queryFn: () => getCallHistory(limit),
    retry: false,
  });
}

export function useCallDetail(callId: string | null) {
  return useQuery({
    queryKey: ["call-detail", callId],
    queryFn: () => getCallDetail(callId!),
    enabled: !!callId,
  });
}
