import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsPanelSkeleton } from "@/components/shared/skeletons";
import { useServerConfig } from "@/hooks/use-server-config";
import { useSettingsStore } from "../stores/settings-store";

interface PersonaEditorProps {
  personaName: string;
  onPersonaNameChange: (name: string) => void;
  onSave: () => void;
  isSaving?: boolean;
}

export function PersonaEditor({
  personaName,
  onPersonaNameChange,
  onSave,
  isSaving,
}: PersonaEditorProps) {
  const config = useServerConfig();
  const settings = useSettingsStore();

  const [promptExpanded, setPromptExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const providers = config.data?.providers ?? {};
  const providerKeys = Object.keys(providers);
  const currentProvider = providers[settings.provider];
  const voices = currentProvider?.voices ?? [];
  const languages = config.data?.languages ?? [];
  const isGemini = settings.provider === "gemini";

  const hasPrompt = settings.systemPrompt.trim().length > 0;

  // Set default provider on first load
  useEffect(() => {
    if (providerKeys.length > 0 && !providers[settings.provider]) {
      const defaultProvider = providerKeys.includes("gemini")
        ? "gemini"
        : providerKeys[0];
      settings.setProvider(defaultProvider);
    }
  }, [providerKeys, providers, settings]);

  if (config.isLoading) {
    return <SettingsPanelSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Persona Name */}
      <div className="flex items-center gap-2">
        <Input
          value={personaName}
          onChange={(e) => onPersonaNameChange(e.target.value)}
          placeholder="Persona name..."
          className="h-9 flex-1 font-medium"
        />
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={isSaving || !personaName.trim()}
          className="h-9 shrink-0"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Provider / Voice / Language — compact row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Provider
          </Label>
          <Select value={settings.provider} onValueChange={settings.setProvider}>
            <SelectTrigger className="h-8 text-xs">
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

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Voice
          </Label>
          <Select value={settings.voice} onValueChange={settings.setVoice}>
            <SelectTrigger className="h-8 text-xs">
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

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Language
          </Label>
          <Select
            value={settings.language}
            onValueChange={settings.setLanguage}
          >
            <SelectTrigger className="h-8 text-xs">
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

      {/* System Prompt — collapsible */}
      <div className="space-y-1">
        <button
          onClick={() => {
            setPromptExpanded(!promptExpanded);
            if (!promptExpanded) {
              setTimeout(() => textareaRef.current?.focus(), 100);
            }
          }}
          className="flex w-full items-center justify-between text-left"
        >
          <Label className="pointer-events-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            System Prompt
            {hasPrompt && !promptExpanded && (
              <span className="ml-2 normal-case tracking-normal text-foreground/50">
                — {settings.systemPrompt.slice(0, 60)}
                {settings.systemPrompt.length > 60 ? "…" : ""}
              </span>
            )}
          </Label>
          {promptExpanded ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </button>
        {promptExpanded && (
          <Textarea
            ref={textareaRef}
            value={settings.systemPrompt}
            onChange={(e) => settings.setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant..."
            rows={4}
            className="resize-y text-xs motion-safe:animate-in motion-safe:fade-in"
          />
        )}
      </div>

      {/* Toggles — Gemini only */}
      {isGemini && (
        <TooltipProvider delayDuration={300}>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <Switch
                checked={settings.affectiveDialog}
                onCheckedChange={settings.setAffectiveDialog}
                id="affective"
                className="scale-90"
              />
              <Label htmlFor="affective" className="text-xs text-muted-foreground">
                Affective
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3 cursor-help text-muted-foreground/50 hover:text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>Emotionally aware responses that adapt to your tone</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={settings.proactiveAudio}
                onCheckedChange={settings.setProactiveAudio}
                id="proactive"
                className="scale-90"
              />
              <Label htmlFor="proactive" className="text-xs text-muted-foreground">
                Proactive
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3 cursor-help text-muted-foreground/50 hover:text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>AI may speak up without waiting for your input</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={settings.googleSearch}
                onCheckedChange={settings.setGoogleSearch}
                id="google-search"
                className="scale-90"
              />
              <Label htmlFor="google-search" className="text-xs text-muted-foreground">
                Search
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3 cursor-help text-muted-foreground/50 hover:text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p>Allows the AI to search Google for real-time info</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
