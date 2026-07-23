import type { ComponentType, ReactNode } from "react";
import { AlertCircle, CheckCircle2, CircleHelp, Clipboard, ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiKeyRecord, SectionId } from "./settings-types";

export function TextField({
  label,
  description,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  error,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="settings-form-row block space-y-2">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {maxLength && <span className="text-[11px] text-muted-foreground">{value.length}/{maxLength}</span>}
      </span>
      {description && <span className="block text-xs leading-5 text-muted-foreground">{description}</span>}
      <input type={type} value={value} maxLength={maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn("h-10 w-full rounded-lg border bg-black/20 px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50", error ? "border-red-400/60" : "border-white/10")} aria-invalid={Boolean(error)} />
      {error && <span className="flex items-center gap-1.5 text-xs text-red-300"><AlertCircle className="h-3.5 w-3.5" />{error}</span>}
    </label>
  );
}

export function TextAreaField({ label, description, value, onChange, placeholder, maxLength, rows = 5 }: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  rows?: number;
}) {
  return (
    <label className="settings-form-row settings-form-row-textarea block space-y-2">
      <span className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-foreground">{label}</span><span className={cn("text-[11px]", value.length >= maxLength ? "text-amber-300" : "text-muted-foreground")}>{value.length}/{maxLength}</span></span>
      {description && <span className="block text-xs leading-5 text-muted-foreground">{description}</span>}
      <textarea value={value} maxLength={maxLength} rows={rows} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/70 focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

export function SelectField({ label, description, value, options, onChange }: {
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-form-row block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {description && <span className="block text-xs leading-5 text-muted-foreground">{description}</span>}
      <span className="relative block">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-black/20 px-3 pr-9 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/20">
          {options.map((option) => <option key={option.value} value={option.value} className="bg-[#0b0d12] text-white">{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
      </span>
    </label>
  );
}

export function ToggleField({ label, description, value, onChange, compact = false }: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("settings-row settings-toggle-card flex items-center justify-between gap-5 rounded-lg border border-white/8 bg-white/[0.015] px-4 py-3.5", compact && "settings-toggle-card-compact")}>
      <div className="min-w-0"><p className="text-sm font-medium text-foreground">{label}</p>{description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}</div>
      <button type="button" role="switch" aria-checked={value} data-state={value ? "on" : "off"} aria-label={`${label}: ${value ? "on" : "off"}`} onClick={() => onChange(!value)} className={cn("settings-toggle-switch relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background", value ? "bg-primary" : "bg-white/15")}>
        <span className="settings-toggle-knob absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform" />
      </button>
    </div>
  );
}

export function SectionCard({ id, title, description, icon: Icon, children, onReset, mobileSection, activeSection }: {
  id: SectionId;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  onReset: (section: SectionId) => void;
  mobileSection?: SectionId | null;
  activeSection?: SectionId;
}) {
  const isVisible = mobileSection ? mobileSection === id : activeSection === id;
  const compactSections: SectionId[] = ["profile", "models", "preferences", "editor", "security", "appearance"];
  return (
    <section id={`settings-${id}`} className={cn("settings-section", id === "profile" && "settings-section-profile", id === "models" && "settings-section-models", compactSections.includes(id) && "settings-section-compact", !isVisible && "hidden")}>
      <div className="settings-section-header flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p></div></div>
        <button type="button" onClick={() => onReset(id)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><RotateCcw className="h-3.5 w-3.5" />Reset section</button>
      </div>
      <div className="settings-section-content space-y-6 px-5 py-6 sm:px-7">{children}</div>
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/12 bg-black/10 px-5 py-8 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground"><Clipboard className="h-4 w-4" /></div><p className="mt-3 text-sm font-medium text-foreground">{title}</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">{description}</p>{action && <div className="mt-4 flex justify-center">{action}</div>}</div>;
}

export function StatusBadge({ status, message }: { status: ApiKeyRecord["status"]; message?: string }) {
  const content = status === "connected" ? "Format validated" : status === "error" ? message ?? "Needs attention" : "Not tested";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]", status === "connected" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : status === "error" ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-white/10 bg-white/5 text-muted-foreground")}>{status === "connected" ? <CheckCircle2 className="h-3 w-3" /> : status === "error" ? <AlertCircle className="h-3 w-3" /> : <CircleHelp className="h-3 w-3" />}{content}</span>;
}