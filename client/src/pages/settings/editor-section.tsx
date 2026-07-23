import { Code2, FileCode2 } from "lucide-react";
import { SectionCard, SelectField, ToggleField } from "./settings-primitives";
import type { EditorSettings, SectionId } from "./settings-types";

export function EditorSection({ settings, updateEditor, mobileSection, activeSection, onReset }: {
  settings: EditorSettings;
  updateEditor: (patch: Partial<EditorSettings>) => void;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  return <SectionCard id="editor" title="Editor" description="Tune the code editor to match the way you work." icon={Code2} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <div className="grid gap-5 md:grid-cols-2">
      <SelectField label="Theme" value={settings.theme} options={[{ value: "nura-dark", label: "NURA Dark" }, { value: "midnight", label: "Midnight" }, { value: "high-contrast", label: "High contrast" }]} onChange={(value) => updateEditor({ theme: value })} />
      <SelectField label="Font family" value={settings.fontFamily} options={[{ value: "Inter", label: "Inter" }, { value: "JetBrains Mono", label: "JetBrains Mono" }, { value: "IBM Plex Mono", label: "IBM Plex Mono" }, { value: "system", label: "System monospace" }]} onChange={(value) => updateEditor({ fontFamily: value })} />
      <SelectField label="Font size" value={String(settings.fontSize)} options={["12", "13", "14", "15", "16", "18"].map((value) => ({ value, label: `${value} px` }))} onChange={(value) => updateEditor({ fontSize: Number(value) })} />
      <SelectField label="Cursor style" value={settings.cursorStyle} options={[{ value: "line", label: "Line" }, { value: "block", label: "Block" }, { value: "underline", label: "Underline" }]} onChange={(value) => updateEditor({ cursorStyle: value })} />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <ToggleField label="Word wrap" description="Wrap long lines to the editor width." value={settings.wordWrap} onChange={(value) => updateEditor({ wordWrap: value })} />
      <ToggleField label="Auto save" description="Persist editor changes as you work." value={settings.autoSave} onChange={(value) => updateEditor({ autoSave: value })} />
      <ToggleField label="Format on save" description="Run the configured formatter when saving a file." value={settings.formatOnSave} onChange={(value) => updateEditor({ formatOnSave: value })} />
      <ToggleField label="Minimap" description="Show a compact overview of the current file." value={settings.minimap} onChange={(value) => updateEditor({ minimap: value })} />
      <ToggleField label="Line numbers" description="Show line numbers next to code." value={settings.lineNumbers} onChange={(value) => updateEditor({ lineNumbers: value })} />
    </div>
    <div className="rounded-xl border border-white/8 bg-[#0b0d12] p-4 font-mono text-xs text-muted-foreground"><div className="mb-3 flex items-center gap-2 border-b border-white/8 pb-3 text-[11px]"><FileCode2 className="h-3.5 w-3.5 text-primary" />preview.ts</div><p><span className="text-primary">const</span> settings = <span className="text-emerald-300">"ready"</span>;</p><p className="mt-1"><span className="text-primary">export default</span> settings;</p><p className="mt-2 text-white/30">1  2  3</p></div>
  </SectionCard>;
}