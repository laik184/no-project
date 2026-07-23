import { Download, Laptop, Monitor, Shield, Trash2 } from "lucide-react";
import { SectionCard, SelectField } from "./settings-primitives";
import type { SecuritySettings, SectionId } from "./settings-types";

export function SecuritySection({ settings, updateSecurity, onDialog, mobileSection, activeSection, onReset }: {
  settings: SecuritySettings;
  updateSecurity: (patch: Partial<SecuritySettings>) => void;
  onDialog: (dialog: "sessions" | "devices" | "export" | "delete") => void;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
  onReset: (section: SectionId) => void;
}) {
  return <SectionCard id="security" title="Security" description="Review local access controls and manage the data stored by this app." icon={Shield} onReset={onReset} mobileSection={mobileSection} activeSection={activeSection}>
    <SelectField label="API key visibility" description="Choose whether configured keys are revealed in provider rows." value={settings.apiKeyVisibility} options={[{ value: "masked", label: "Always masked" }, { value: "reveal", label: "Reveal while working" }]} onChange={(value) => updateSecurity({ apiKeyVisibility: value as SecuritySettings["apiKeyVisibility"] })} />
    <div className="grid gap-3 md:grid-cols-2">
      <button type="button" onClick={() => onDialog("sessions")} className="settings-row settings-action-row flex items-center gap-3 rounded-xl border border-white/8 bg-black/10 p-4 text-left transition hover:border-primary/30 hover:bg-white/[0.03]"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Laptop className="h-4 w-4" /></div><span><span className="block text-sm font-medium text-foreground">Sessions</span><span className="mt-1 block text-xs text-muted-foreground">This browser is the only local session.</span></span></button>
      <button type="button" onClick={() => onDialog("devices")} className="settings-row settings-action-row flex items-center gap-3 rounded-xl border border-white/8 bg-black/10 p-4 text-left transition hover:border-primary/30 hover:bg-white/[0.03]"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300"><Monitor className="h-4 w-4" /></div><span><span className="block text-sm font-medium text-foreground">Devices</span><span className="mt-1 block text-xs text-muted-foreground">No synced devices in frontend-only mode.</span></span></button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => onDialog("export")} className="settings-row settings-action-row inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm text-foreground hover:bg-white/5"><Download className="h-4 w-4 text-primary" />Export local data</button><button type="button" onClick={() => onDialog("delete")} className="settings-row settings-action-row inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.05] px-3 py-2.5 text-sm text-red-300 hover:bg-red-400/10"><Trash2 className="h-4 w-4" />Delete local account data</button></div>
  </SectionCard>;
}