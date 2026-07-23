import { Code2, Sparkles } from "lucide-react";
import { SectionCard, SelectField, TextAreaField, ToggleField } from "./settings-primitives";
import type { PreferenceSettings, SectionId } from "./settings-types";

export function PreferencesSection({ settings, updatePreferences, mobileSection, activeSection, onReset }: {
  settings: PreferenceSettings;
  updatePreferences: (patch: Partial<PreferenceSettings>) => void;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  const languages = [{ value: "typescript", label: "TypeScript" }, { value: "javascript", label: "JavaScript" }, { value: "python", label: "Python" }, { value: "go", label: "Go" }, { value: "rust", label: "Rust" }];
  return <SectionCard id="preferences" title="AI Preferences" description="Give the agent durable context for coding and communication." icon={Sparkles} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <TextAreaField label="Custom instructions" description="Applied to every new agent conversation in this browser." value={settings.customInstructions} onChange={(value) => updatePreferences({ customInstructions: value })} placeholder="Example: Prefer small, reviewable changes and explain trade-offs briefly." maxLength={2000} />
    <TextAreaField label="System prompt" description="Optional advanced instruction for your local agent setup." value={settings.systemPrompt} onChange={(value) => updatePreferences({ systemPrompt: value })} placeholder="Define boundaries, tone, or project conventions." maxLength={4000} />
    <div className="grid gap-5 md:grid-cols-2">
      <SelectField label="Coding style" value={settings.codingStyle} options={[{ value: "pragmatic", label: "Pragmatic and concise" }, { value: "explicit", label: "Explicit and defensive" }, { value: "minimal", label: "Minimal abstraction" }, { value: "functional", label: "Functional patterns" }]} onChange={(value) => updatePreferences({ codingStyle: value })} />
      <SelectField label="Response style" value={settings.responseStyle} options={[{ value: "balanced", label: "Balanced" }, { value: "concise", label: "Concise" }, { value: "detailed", label: "Detailed" }, { value: "teaching", label: "Teaching" }]} onChange={(value) => updatePreferences({ responseStyle: value })} />
      <SelectField label="Preferred language" value={settings.preferredLanguage} options={languages} onChange={(value) => updatePreferences({ preferredLanguage: value })} />
      <SelectField label="Reasoning level" value={settings.reasoningLevel} options={[{ value: "minimal", label: "Minimal" }, { value: "standard", label: "Standard" }, { value: "deep", label: "Deep" }]} onChange={(value) => updatePreferences({ reasoningLevel: value })} />
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      <ToggleField label="Auto continue" description="Continue a response when it reaches the output limit." value={settings.autoContinue} onChange={(value) => updatePreferences({ autoContinue: value })} />
      <ToggleField label="Planning mode" description="Show a plan before multi-step work." value={settings.planningMode} onChange={(value) => updatePreferences({ planningMode: value })} />
      <div className="settings-row settings-info-row flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3.5"><div><p className="text-sm font-medium text-foreground">Current language</p><p className="mt-1 text-xs text-muted-foreground">{languages.find((item) => item.value === settings.preferredLanguage)?.label ?? settings.preferredLanguage}</p></div><Code2 className="h-4 w-4 text-primary" /></div>
    </div>
  </SectionCard>;
}