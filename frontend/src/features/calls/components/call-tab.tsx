import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Phone,
  PhoneCall,
  PhoneOff,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Persona, PhoneNumber } from "@/types";
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

type CallState = "idle" | "placing" | "ringing" | "connected" | "ended" | "error";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);

  const placeCall = usePlaceCall();
  const hangupMutation = useHangupCall();

  // Poll call status while active
  const isCallActive = callState === "placing" || callState === "ringing" || callState === "connected";
  const { data: callStatus } = useCallStatus(activeCallSid, isCallActive);

  // Sync persona selection with active persona
  useEffect(() => {
    if (activePersonaId) {
      setSelectedPersonaId(activePersonaId);
    }
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
      s === "completed" ||
      s === "busy" ||
      s === "no-answer" ||
      s === "canceled" ||
      s === "failed"
    ) {
      setCallState("ended");
    }
  }, [callStatus]);

  // Timer
  useEffect(() => {
    if (callState !== "connected") {
      if (callState === "idle") setCallSeconds(0);
      return;
    }
    const interval = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const handlePlaceCall = useCallback(async () => {
    if (!toNumber.trim() || !fromNumber || !selectedPersonaId) {
      toast.error("Please fill in all fields");
      return;
    }

    setCallState("placing");
    setErrorMessage("");

    try {
      const result = await placeCall.mutateAsync({
        to: toNumber.trim(),
        from: fromNumber,
        personaId: selectedPersonaId,
      });
      setActiveCallSid(result.callSid);
      setCallState("ringing");
      toast.success("Call placed");
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
      toast.success("Call ended");
    } catch (e) {
      toast.error("Failed to hang up");
    }
  }, [activeCallSid, hangupMutation]);

  const handleNewCall = useCallback(() => {
    setCallState("idle");
    setActiveCallSid(null);
    setCallSeconds(0);
    setErrorMessage("");
  }, []);

  const mins = Math.floor(callSeconds / 60);
  const secs = callSeconds % 60;
  const timerDisplay = `${mins}:${secs.toString().padStart(2, "0")}`;

  const linkedNumbers = phoneNumbers.filter((n) => n.linked);
  const availableNumbers = linkedNumbers.length > 0 ? linkedNumbers : phoneNumbers;

  return (
    <div className="flex h-full flex-col">
      {/* Idle / Setup state */}
      {(callState === "idle" || callState === "error") && (
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
              <Phone className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Place an outbound call
            </p>
          </div>

          {/* To Number */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Call To
            </Label>
            <Input
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="h-9 font-mono"
              type="tel"
            />
          </div>

          {/* From Number */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              From (Your Twilio Number)
            </Label>
            {phoneNumbersLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Loading numbers...
              </div>
            ) : availableNumbers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No Twilio numbers available. Configure in Admin settings.
              </p>
            ) : (
              <Select value={fromNumber} onValueChange={setFromNumber}>
                <SelectTrigger className="h-9 font-mono text-xs">
                  <SelectValue placeholder="Select a number" />
                </SelectTrigger>
                <SelectContent>
                  {availableNumbers.map((n) => (
                    <SelectItem key={n.twilioSid} value={n.phoneNumber}>
                      {n.friendlyName
                        ? `${n.friendlyName} (${n.phoneNumber})`
                        : n.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Persona */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Agent Persona
            </Label>
            {personas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Create a persona first in the Configure tab.
              </p>
            ) : (
              <Select
                value={selectedPersonaId}
                onValueChange={setSelectedPersonaId}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select a persona" />
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

          {/* Error */}
          {callState === "error" && errorMessage && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="size-3.5 shrink-0" />
              {errorMessage}
            </div>
          )}

          {/* Place Call Button */}
          <Button
            onClick={handlePlaceCall}
            disabled={
              !toNumber.trim() ||
              !fromNumber ||
              !selectedPersonaId ||
              placeCall.isPending
            }
            className="mt-2 gap-2"
          >
            {placeCall.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PhoneCall className="size-4" />
            )}
            {placeCall.isPending ? "Placing Call..." : "Place Call"}
          </Button>
        </div>
      )}

      {/* Active Call state */}
      {(callState === "ringing" ||
        callState === "placing" ||
        callState === "connected") && (
        <div className="flex flex-1 flex-col">
          {/* Call Info Header */}
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
            <div className="flex-1">
              <p className="text-sm font-medium">
                {callState === "connected"
                  ? "Connected"
                  : callState === "ringing"
                    ? "Ringing..."
                    : "Placing call..."}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {toNumber}
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

          {/* Live Transcript (from Convex via call detail polling) */}
          <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
            <div className="space-y-2">
              <PhoneCall
                className={cn(
                  "mx-auto size-10",
                  callState === "connected"
                    ? "text-green-500"
                    : "text-primary motion-safe:animate-pulse",
                )}
              />
              <p className="text-sm text-muted-foreground">
                {callState === "connected"
                  ? "Call in progress — transcript will appear in call history"
                  : "Waiting for the call to be answered..."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ended state */}
      {callState === "ended" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <PhoneOff className="size-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Call Ended</p>
            <p className="font-mono text-xs text-muted-foreground">{toNumber}</p>
            {callSeconds > 0 && (
              <p className="text-xs text-muted-foreground">
                Duration: {timerDisplay}
              </p>
            )}
            {callStatus?.status && (
              <p className="mt-1 text-xs text-muted-foreground">
                Status: {callStatus.status}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleNewCall} className="gap-2">
            <Phone className="size-4" />
            New Call
          </Button>
        </div>
      )}
    </div>
  );
}
