import { Bot } from "lucide-react";
import { SectionCard, SelectField, TextField, ToggleField } from "./settings-primitives";
import type { ModelSettings, ProviderDetails, SectionId } from "./settings-types";

export function ModelsSection({ settings, providers, updateModels, mobileSection, activeSection, onReset }: {
  settings: ModelSettings;
  providers: ProviderDetails[];
  updateModels: (patch: Partial<ModelSettings>) => void;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  return <SectionCard id="models" title="AI Models" description="Choose the provider and generation defaults used by the agent." icon={Bot} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <div className="grid gap-5 md:grid-cols-2">
      <SelectField label="Provider selection" description="The provider used for new agent runs." value={settings.provider} options={providers.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => updateModels({ provider: value as ModelSettings["provider"], defaultModel: providers.find((item) => item.id === value)?.model ?? settings.defaultModel })} />
      <TextField label="Default AI" description="The assistant persona shown in new chats." value={settings.defaultAI} onChange={(value) => updateModels({ defaultAI: value })} placeholder="NURA Agent" maxLength={40} />
      <TextField label="Default model" description="Model identifier passed to the selected provider." value={settings.defaultModel} onChange={(value) => updateModels({ defaultModel: value })} placeholder={providers.find((item) => item.id === settings.provider)?.model} maxLength={80} />
      <SelectField label="Max tokens" description="Upper bound for each response." value={String(settings.maxTokens)} options={["2048", "4096", "8192", "16384", "32768"].map((value) => ({ value, label: `${Number(value).toLocaleString()} tokens` }))} onChange={(value) => updateModels({ maxTokens: Number(value) })} />
    </div>
    <div className="settings-row settings-model-temperature rounded-xl border border-white/8 bg-black/10 p-4">
      <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-medium text-foreground">Temperature</p><p className="mt-1 text-xs text-muted-foreground">Lower values are focused; higher values are more exploratory.</p></div><span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-xs text-primary">{settings.temperature.toFixed(1)}</span></div>
      <input type="range" min="0" max="1.5" step="0.1" value={settings.temperature} onChange={(event) => updateModels({ temperature: Number(event.target.value) })} className="h-1.5 w-full cursor-pointer accent-primary" aria-label="Temperature" />
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>Precise</span><span>Creative</span></div>
    </div>
    <ToggleField compact label="Streaming responses" description="Show generated text as it arrives instead of waiting for the complete response." value={settings.streaming} onChange={(value) => updateModels({ streaming: value })} />
  </SectionCard>;
}