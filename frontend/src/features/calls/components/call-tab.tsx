import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  Loader2,
  Phone,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCallDetail, useCallHistory } from "@/features/admin/api/use-twilio";
import type { CallRecord, Persona, PhoneNumber } from "@/types";
import {
  useCallStatus,
  useHangupCall,
  usePlaceCall,
} from "../api/use-outbound-call";

interface CallTabProps {
  personas: Persona[];
  activePersonaId: string | null;
  phoneNumbers: PhoneNumber[];
  phoneNumbersLoading: boolean;
}

type CallState =
  | "idle"
  | "confirm"
  | "placing"
  | "ringing"
  | "connected"
  | "ended"
  | "error";

/** Format a raw phone string for display (US numbers). */
function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/** Normalize input to E.164. */
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw.replace(/[^\d+]/g, "");
  return `+${digits}`;
}

export function CallTab({
  personas,
  activePersonaId,
  phoneNumbers,
  phoneNumbersLoading,
}: CallTabProps) {
  const [toNumber, setToNumber] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    activePersonaId ?? "",
  );
  const [callState, setCallState] = useState<CallState>("idle");
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [activeCallConvexId, setActiveCallConvexId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);

  const placeCall = usePlaceCall();
  const hangupMutation = useHangupCall();
  const { data: recentCalls = [] } = useCallHistory(10);

  // Poll call status while active
  const isCallActive =
    callState === "placing" ||
    callState === "ringing" ||
    callState === "connected";
  const { data: callStatus } = useCallStatus(activeCallSid, isCallActive);

  // Poll live transcript during connected call (every 3s when active)
  const { data: liveCallDetail } = useCallDetail(
    activeCallConvexId,
    isCallActive ? 3000 : undefined,
  );
  const liveMessages = liveCallDetail?.messages ?? [];

  // Derive recent outbound calls for quick redial
  const recentOutbound = useMemo(
    () =>
      recentCalls
        .filter((c: CallRecord) => c.to && c.to !== c.from)
        .slice(0, 5),
    [recentCalls],
  );

  // Sync persona selection with active persona
  useEffect(() => {
    if (activePersonaId) setSelectedPersonaId(activePersonaId);
  }, [activePersonaId]);

  // Auto-select first from number
  useEffect(() => {
    if (phoneNumbers.length > 0 && !fromNumber) {
      const linked = phoneNumbers.find((n) => n.linked);
      setFromNumber(linked?.phoneNumber ?? phoneNumbers[0].phoneNumber);
    }
  }, [phoneNumbers, fromNumber]);

  // Update call state from status polling
  useEffect(() => {
    if (!callStatus) return;
    const s = callStatus.status;
    if (s === "ringing" || s === "queued" || s === "initiated") {
      setCallState("ringing");
    } else if (s === "in-progress") {
      setCallState("connected");
    } else if (
      ["completed", "busy", "no-answer", "canceled", "failed"].includes(s)
    ) {
      setCallState("ended");
    }
  }, [callStatus]);

  // Find Convex call ID for live transcript
  useEffect(() => {
    if (!activeCallSid || activeCallConvexId) return;
    // The most recent call should be ours
    if (recentCalls.length > 0) {
      setActiveCallConvexId(recentCalls[0]._id);
    }
  }, [activeCallSid, activeCallConvexId, recentCalls]);

  // Timer
  useEffect(() => {
    if (callState !== "connected") {
      if (callState === "idle") setCallSeconds(0);
      return;
    }
    const interval = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const selectedPersona = personas.find((p) => p._id === selectedPersonaId);

  const handleConfirmCall = useCallback(() => {
    if (!toNumber.trim() || !fromNumber || !selectedPersonaId) {
      toast.error("Please fill in all fields");
      return;
    }
    setCallState("confirm");
  }, [toNumber, fromNumber, selectedPersonaId]);

  const handlePlaceCall = useCallback(async () => {
    setCallState("placing");
    setErrorMessage("");
    setActiveCallConvexId(null);

    const e164 = toE164(toNumber);
    try {
      const result = await placeCall.mutateAsync({
        to: e164,
        from: fromNumber,
        personaId: selectedPersonaId,
      });
      setActiveCallSid(result.callSid);
      setCallState("ringing");
    } catch (e) {
      setCallState("error");
      const msg = e instanceof Error ? e.message : "Failed to place call";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }, [toNumber, fromNumber, selectedPersonaId, placeCall]);

  const handleHangup = useCallback(async () => {
    if (!activeCallSid) return;
    try {
      await hangupMutation.mutateAsync(activeCallSid);
      setCallState("ended");
    } catch {
      toast.error("Failed to hang up");
    }
  }, [activeCallSid, hangupMutation]);

  const handleNewCall = useCallback(() => {
    setCallState("idle");
    setActiveCallSid(null);
    setActiveCallConvexId(null);
    setCallSeconds(0);
    setErrorMessage("");
  }, []);

  const handleQuickDial = useCallback((call: CallRecord) => {
    setToNumber(call.to);
    setCallState("idle");
  }, []);

  const mins = Math.floor(callSeconds / 60);
  const secs = callSeconds % 60;
  const timerDisplay = `${mins}:${secs.toString().padStart(2, "0")}`;

  const availableNumbers =
    phoneNumbers.length > 0 ? phoneNumbers : [];

  return (
    <div className="flex h-full flex-col">
      {/* ─── Idle / Setup ─── */}
      {(callState === "idle" || callState === "error") && (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-4">
            {/* Header */}
            <div className="flex flex-col items-center gap-1 py-1">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
                <Phone className="size-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Place a Call</p>
            </div>

            {/* To Number */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Phone Number
              </Label>
              <Input
                value={toNumber}
                onChange={(e) => setToNumber(e.target.value)}
                placeholder="+1 (305) 555-1234"
                className="h-9 font-mono text-sm"
                type="tel"
              />
            </div>

            {/* From + Persona row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  From
                </Label>
                {phoneNumbersLoading ? (
                  <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                  </div>
                ) : availableNumbers.length === 0 ? (
                  <p className="py-2 text-[10px] text-muted-foreground">
                    No numbers — configure in Admin
                  </p>
                ) : (
                  <Select value={fromNumber} onValueChange={setFromNumber}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableNumbers.map((n) => (
                        <SelectItem key={n.twilioSid} value={n.phoneNumber}>
                          {n.friendlyName || formatPhoneDisplay(n.phoneNumber)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Agent
                </Label>
                {personas.length === 0 ? (
                  <p className="py-2 text-[10px] text-muted-foreground">
                    Create a persona first
                  </p>
                ) : (
                  <Select
                    value={selectedPersonaId}
                    onValueChange={setSelectedPersonaId}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Error */}
            {callState === "error" && errorMessage && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="size-3.5 shrink-0" />
                {errorMessage}
              </div>
            )}

            {/* Place Call Button */}
            <Button
              onClick={handleConfirmCall}
              disabled={
                !toNumber.trim() ||
                !fromNumber ||
                !selectedPersonaId ||
                placeCall.isPending
              }
              className="gap-2"
              size="lg"
            >
              <PhoneCall className="size-4" />
              Place Call
            </Button>

            {/* Recent Calls */}
            {recentOutbound.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </Label>
                <div className="flex flex-col gap-0.5">
                  {recentOutbound.map((c: CallRecord) => (
                    <button
                      key={c._id}
                      onClick={() => handleQuickDial(c)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                    >
                      <ArrowUpRight className="size-3 shrink-0 text-primary/60" />
                      <span className="flex-1 truncate font-mono">
                        {formatPhoneDisplay(c.to)}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60">
                        {c.personaName ?? "—"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* ─── Confirmation ─── */}
      {callState === "confirm" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <PhoneCall className="size-6 text-primary" />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium">Confirm Call</p>
            <p className="font-mono text-lg font-semibold">
              {formatPhoneDisplay(toNumber)}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Badge variant="secondary" className="text-[10px]">
                From: {formatPhoneDisplay(fromNumber)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {selectedPersona?.name ?? "—"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCallState("idle")}
            >
              Cancel
            </Button>
            <Button onClick={handlePlaceCall} className="gap-2">
              <PhoneCall className="size-4" />
              Call Now
            </Button>
          </div>
        </div>
      )}

      {/* ─── Active Call ─── */}
      {(callState === "ringing" ||
        callState === "placing" ||
        callState === "connected") && (
        <div className="flex flex-1 flex-col">
          {/* Status bar */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="relative flex items-center justify-center">
              {callState === "connected" ? (
                <>
                  <span className="absolute size-3 rounded-full bg-green-500/30 motion-safe:animate-ping" />
                  <span className="relative size-2 rounded-full bg-green-500" />
                </>
              ) : (
                <Loader2 className="size-4 animate-spin text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {callState === "connected"
                  ? "Connected"
                  : callState === "ringing"
                    ? "Ringing..."
                    : "Placing call..."}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {formatPhoneDisplay(toNumber)}
                {selectedPersona && (
                  <span className="ml-2 font-sans text-muted-foreground/60">
                    · {selectedPersona.name}
                  </span>
                )}
              </p>
            </div>
            {callState === "connected" && (
              <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <Timer className="size-3" />
                {timerDisplay}
              </span>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleHangup}
              disabled={hangupMutation.isPending}
              className="gap-1.5"
            >
              <PhoneOff className="size-3.5" />
              Hang Up
            </Button>
          </div>

          {/* Live Transcript */}
          <ScrollArea className="flex-1">
            <div className="space-y-1.5 p-4">
              {liveMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <PhoneCall
                    className={cn(
                      "size-8",
                      callState === "connected"
                        ? "text-green-500"
                        : "text-primary motion-safe:animate-pulse",
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {callState === "connected"
                      ? "Conversation in progress..."
                      : "Waiting for answer..."}
                  </p>
                </div>
              )}
              {liveMessages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs motion-safe:animate-in motion-safe:fade-in",
                    m.role === "caller" &&
                      "bg-yellow-500/10 text-yellow-400",
                    m.role === "agent" &&
                      "bg-primary/10 text-primary",
                  )}
                >
                  <span className="font-medium">
                    {m.role === "caller" ? "📞 Caller" : "🤖 Agent"}:{" "}
                  </span>
                  {m.text}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ─── Ended ─── */}
      {callState === "ended" && (
        <div className="flex flex-1 flex-col">
          {/* Summary */}
          <div className="flex flex-col items-center gap-3 border-b border-border px-4 py-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <PhoneOff className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Call Ended</p>
              <p className="font-mono text-xs text-muted-foreground">
                {formatPhoneDisplay(toNumber)}
              </p>
              <div className="mt-1.5 flex items-center justify-center gap-2">
                {callSeconds > 0 && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Clock className="size-2.5" />
                    {timerDisplay}
                  </Badge>
                )}
                {callStatus?.status && (
                  <Badge
                    variant={
                      callStatus.status === "completed"
                        ? "default"
                        : "destructive"
                    }
                    className="text-[10px]"
                  >
                    {callStatus.status}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewCall}
                className="gap-1.5"
              >
                <Phone className="size-3.5" />
                New Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlaceCall}
                className="gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                Redial
              </Button>
            </div>
          </div>

          {/* Post-call transcript */}
          {liveMessages.length > 0 && (
            <ScrollArea className="flex-1">
              <div className="space-y-1.5 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Transcript
                </p>
                {liveMessages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md px-3 py-2 text-xs",
                      m.role === "caller" &&
                        "bg-yellow-500/10 text-yellow-400",
                      m.role === "agent" &&
                        "bg-primary/10 text-primary",
                    )}
                  >
                    <span className="font-medium">
                      {m.role === "caller" ? "📞 Caller" : "🤖 Agent"}:{" "}
                    </span>
                    {m.text}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
