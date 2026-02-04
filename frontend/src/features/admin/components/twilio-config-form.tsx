import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveTwilioConfig, useTwilioConfig } from "../api/use-twilio";

export function TwilioConfigForm() {
  const { data: config, isLoading } = useTwilioConfig();
  const saveMutation = useSaveTwilioConfig();

  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (config?.configured) {
      setAccountSid(config.accountSid ?? "");
      setWebhookUrl(config.webhookBaseUrl ?? "");
    }
  }, [config]);

  const handleSave = async () => {
    if (!accountSid.trim()) {
      toast.error("Account SID is required");
      return;
    }

    const body: Record<string, string> = {
      accountSid: accountSid.trim(),
      webhookBaseUrl: webhookUrl.trim(),
    };
    if (authToken.trim()) {
      body.authToken = authToken.trim();
    }

    try {
      await saveMutation.mutateAsync(body);
      setAuthToken("");
      toast.success("Twilio config saved");
    } catch (e) {
      toast.error(
        `Failed to save: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading config...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium">Twilio Configuration</h4>
        {config?.configured && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="size-3" />
            Configured
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Account SID</Label>
          <Input
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            placeholder="AC..."
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Auth Token</Label>
          <Input
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder={config?.configured ? "••••••••" : "Auth token"}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Webhook Base URL</Label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-domain.com"
          />
        </div>
      </div>

      <Button
        size="sm"
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="gap-1.5"
      >
        {saveMutation.isPending && (
          <Loader2 className="size-3.5 animate-spin" />
        )}
        Save Twilio Config
      </Button>
    </div>
  );
}
