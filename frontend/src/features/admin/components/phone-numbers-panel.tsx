import { Link2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Persona } from "@/types";
import {
  useLinkPhoneNumber,
  usePhoneNumbers,
  useUnlinkPhoneNumber,
} from "../api/use-twilio";

interface PhoneNumbersPanelProps {
  personas: Persona[];
}

export function PhoneNumbersPanel({ personas }: PhoneNumbersPanelProps) {
  const { data: numbers, isLoading, refetch } = usePhoneNumbers();
  const linkMutation = useLinkPhoneNumber();
  const unlinkMutation = useUnlinkPhoneNumber();

  // Track selected persona per phone number
  const [selectedPersonas, setSelectedPersonas] = useState<
    Record<string, string>
  >({});

  const handleLink = async (
    phoneNumber: string,
    twilioSid: string,
    friendlyName: string,
  ) => {
    const personaId = selectedPersonas[twilioSid];
    if (!personaId) {
      toast.error("Select a persona first");
      return;
    }

    try {
      await linkMutation.mutateAsync({
        phoneNumber,
        twilioSid,
        personaId,
        friendlyName,
      });
      toast.success("Phone number linked");
    } catch (e) {
      toast.error(
        `Link failed: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await unlinkMutation.mutateAsync(linkId);
      toast.success("Phone number unlinked");
    } catch (e) {
      toast.error(
        `Unlink failed: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Phone Numbers</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </div>
      )}

      {!isLoading && (!numbers || numbers.length === 0) && (
        <p className="text-sm text-muted-foreground">No phone numbers found</p>
      )}

      {numbers && numbers.length > 0 && (
        <div className="space-y-2">
          {numbers.map((n) => (
            <div
              key={n.twilioSid}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {n.friendlyName || n.phoneNumber}
                </p>
                {n.friendlyName && (
                  <p className="text-xs text-muted-foreground">
                    {n.phoneNumber}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={
                    selectedPersonas[n.twilioSid] ?? n.personaId ?? ""
                  }
                  onValueChange={(val) =>
                    setSelectedPersonas((prev) => ({
                      ...prev,
                      [n.twilioSid]: val,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="— Not linked —" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {n.linked ? (
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="border-green-500/30 text-green-400"
                    >
                      ● Linked
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => handleUnlink(n.linkId!)}
                      disabled={unlinkMutation.isPending}
                    >
                      <Unlink className="size-3" />
                      Unlink
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() =>
                      handleLink(
                        n.phoneNumber,
                        n.twilioSid,
                        n.friendlyName ?? "",
                      )
                    }
                    disabled={linkMutation.isPending}
                  >
                    <Link2 className="size-3" />
                    Link
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
