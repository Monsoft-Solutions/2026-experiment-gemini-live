import { API_BASE } from "@/config";
import type {
  CallDetail,
  CallRecord,
  PhoneNumber,
  ServerConfig,
  TwilioConfig,
} from "@/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function getServerConfig(): Promise<ServerConfig> {
  return fetchJson<ServerConfig>("/config");
}

export function getTwilioConfig(): Promise<TwilioConfig> {
  return fetchJson<TwilioConfig>("/twilio/config");
}

export function saveTwilioConfig(
  data: Partial<TwilioConfig>,
): Promise<void> {
  return fetchJson("/twilio/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function getPhoneNumbers(): Promise<PhoneNumber[]> {
  return fetchJson<PhoneNumber[]>("/twilio/numbers");
}

export function linkPhoneNumber(data: {
  phoneNumber: string;
  twilioSid: string;
  personaId: string;
  friendlyName: string;
}): Promise<void> {
  return fetchJson("/twilio/numbers/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function unlinkPhoneNumber(linkId: string): Promise<void> {
  return fetchJson("/twilio/numbers/unlink", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkId }),
  });
}

export function getCallHistory(limit = 20): Promise<CallRecord[]> {
  return fetchJson<CallRecord[]>(`/twilio/calls?limit=${limit}`);
}

export function getCallDetail(callId: string): Promise<CallDetail> {
  return fetchJson<CallDetail>(`/twilio/calls/${callId}`);
}
