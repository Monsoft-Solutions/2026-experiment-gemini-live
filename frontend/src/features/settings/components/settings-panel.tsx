import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SettingsPanelSkeleton } from "@/components/shared/skeletons";
import { useServerConfig } from "@/hooks/use-server-config";
import { useSettingsStore } from "../stores/settings-store";

export function SettingsPanel() {
  const config = useServerConfig();
  const settings = useSettingsStore();

  const providers = config.data?.providers ?? {};
  const providerKeys = Object.keys(providers);
  const currentProvider = providers[settings.provider];
  const voices = currentProvider?.voices ?? [];
  const languages = config.data?.languages ?? [];
  const isGemini = settings.provider === "gemini";

  // Set default provider on first load
  useEffect(() => {
    if (providerKeys.length > 0 && !providers[settings.provider]) {
      const defaultProvider = providerKeys.includes("gemini")
        ? "gemini"
        : providerKeys[0];
      settings.setProvider(defaultProvider);
    }
  }, [providerKeys, providers, settings]);

  // Show skeleton while loading
  if (config.isLoading) {
    return <SettingsPanelSkeleton />;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 transition-all duration-300 animate-in fade-in">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Provider */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Provider
          </Label>
          <Select value={settings.provider} onValueChange={settings.setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {providers[key].displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Voice
          </Label>
          <Select value={settings.voice} onValueChange={settings.setVoice}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} — {v.style}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Language
          </Label>
          <Select
            value={settings.language}
            onValueChange={settings.setLanguage}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          System Prompt
        </Label>
        <Textarea
          value={settings.systemPrompt}
          onChange={(e) => settings.setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant..."
          rows={3}
          className="resize-y"
        />
      </div>

      {/* Toggles — Gemini only */}
      {isGemini && (
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.affectiveDialog}
              onCheckedChange={settings.setAffectiveDialog}
              id="affective"
            />
            <Label htmlFor="affective" className="text-sm text-muted-foreground">
              Affective Dialog
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.proactiveAudio}
              onCheckedChange={settings.setProactiveAudio}
              id="proactive"
            />
            <Label htmlFor="proactive" className="text-sm text-muted-foreground">
              Proactive Audio
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.googleSearch}
              onCheckedChange={settings.setGoogleSearch}
              id="google-search"
            />
            <Label
              htmlFor="google-search"
              className="text-sm text-muted-foreground"
            >
              Google Search
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
