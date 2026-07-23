import { Moon, Palette } from "lucide-react";
import { SectionCard, SelectField, ToggleField } from "./settings-primitives";
import type { AppearanceSettings, SectionId } from "./settings-types";

export function AppearanceSection({ settings, updateAppearance, mobileSection, activeSection, onReset }: {
  settings: AppearanceSettings;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  return <SectionCard id="appearance" title="Appearance" description="Make the workspace feel right across your screen sizes." icon={Palette} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <div className="grid gap-5 md:grid-cols-2">
      <SelectField label="Theme" description="Applied to this settings experience." value={settings.theme} options={[{ value: "dark", label: "Dark" }, { value: "system", label: "System" }, { value: "light", label: "Light preview" }]} onChange={(value) => updateAppearance({ theme: value as AppearanceSettings["theme"] })} />
      <SelectField label="Sidebar" description="Preferred default density for the app sidebar." value={settings.sidebar} options={[{ value: "collapsed", label: "Collapsed" }, { value: "expanded", label: "Expanded" }]} onChange={(value) => updateAppearance({ sidebar: value as AppearanceSettings["sidebar"] })} />
    </div>
    <div className="settings-row settings-accent-row"><p className="mb-2 text-sm font-medium text-foreground">Accent color</p><div className="flex flex-wrap items-center gap-2">{["#7c8dff", "#a78bfa", "#22c55e", "#38bdf8", "#f59e0b", "#f472b6"].map((color) => <button type="button" key={color} onClick={() => updateAppearance({ accentColor: color })} className={`h-8 w-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${settings.accentColor === color ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: color }} aria-label={`Use ${color} accent`} />)}<label className="ml-1 flex h-8 items-center gap-2 rounded-lg border border-white/10 px-2 text-xs text-muted-foreground"><input type="color" value={settings.accentColor} onChange={(event) => updateAppearance({ accentColor: event.target.value })} className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Custom accent color" />Custom</label></div></div>
    <div className="grid gap-3 md:grid-cols-2">
      <ToggleField label="Compact mode" description="Reduce card and row spacing throughout settings." value={settings.compactMode} onChange={(value) => updateAppearance({ compactMode: value })} />
      <ToggleField label="Animations" description="Use subtle transitions for navigation and state changes." value={settings.animations} onChange={(value) => updateAppearance({ animations: value })} />
      <ToggleField label="Reduced motion" description="Prefer minimal movement for accessibility." value={settings.reducedMotion} onChange={(value) => updateAppearance({ reducedMotion: value })} />
    </div>
    <div className="settings-row settings-info-row flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-xs leading-5 text-muted-foreground"><Moon className="h-4 w-4 shrink-0 text-primary" /><span>Current preview uses <strong className="text-foreground">{settings.theme === "system" ? "system" : settings.theme}</strong> mode with a <strong className="text-foreground">{settings.accentColor}</strong> accent.</span></div>
  </SectionCard>;
}