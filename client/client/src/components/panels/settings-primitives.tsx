import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const PANEL_CSS = `
  @keyframes sp-overlay-in { from{opacity:0} to{opacity:1} }
  @keyframes sp-slide-in    { from{transform:translateX(100%)} to{transform:translateX(0)} }
  @keyframes sp-slide-out   { from{transform:translateX(0)} to{transform:translateX(100%)} }
  @keyframes sp-bar-fill    { from{width:0%} to{width:var(--bar-w)} }
  .sp-overlay-in { animation: sp-overlay-in 0.22s ease-out both; }
  .sp-slide-in   { animation: sp-slide-in   0.3s cubic-bezier(.32,.72,0,1) both; }
  .sp-slide-out  { animation: sp-slide-out  0.25s cubic-bezier(.32,.72,0,1) both; }
  .sp-bar        { animation: sp-bar-fill   0.7s 0.2s ease-out both; }
  .sp-toast { animation: sp-overlay-in 0.18s ease-out both; }
`;

export function Row({ icon: Icon, iconColor = "#94a3b8", label, sub, children, danger }: {
  icon: React.ElementType;
  iconColor?: string;
  label: string;
  sub?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-white/[0.025] transition-colors rounded-lg -mx-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}25` }}>
        <Icon style={{ width: 13, height: 13, color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-[12.5px] font-medium", danger ? "text-red-400" : "text-foreground/90")}>{label}</div>
        {sub && <div className="text-[10.5px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="relative flex-shrink-0 transition-all duration-200" style={{ width: 36, height: 20 }} data-testid="settings-toggle">
      <div className="absolute inset-0 rounded-full transition-all duration-200" style={{ background: value ? "linear-gradient(135deg, #7c8dff, #a78bfa)" : "rgba(255,255,255,0.1)", boxShadow: value ? "0 0 10px rgba(124,141,255,0.4)" : "none" }} />
      <div className="absolute top-0.5 rounded-full bg-white shadow-sm transition-all duration-200" style={{ width: 16, height: 16, left: value ? 18 : 2 }} />
    </button>
  );
}

export function Select({ value, options, onChange }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(226,232,240,0.85)", minWidth: 100 }}>
        <span className="flex-1 text-left">{current?.label}</span>
        <ChevronDown style={{ width: 10, height: 10, color: "rgba(148,163,184,0.6)" }} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 rounded-xl overflow-hidden py-1" style={{ background: "rgba(13,13,28,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 -8px 32px rgba(0,0,0,0.5)", minWidth: 130 }}>
          {options.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] hover:bg-white/5 transition-colors" style={{ color: o.value === value ? "#a78bfa" : "rgba(203,213,225,0.8)" }}>
              {o.value === value && <Check style={{ width: 10, height: 10, color: "#a78bfa" }} />}
              {o.value !== value && <span style={{ width: 10 }} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Slider({ value, onChange, min = 10, max = 24 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground/50 w-6 text-right">{min}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24 h-1 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #7c8dff ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 0%)`, accentColor: "#7c8dff" }} />
      <span className="text-[10px] text-muted-foreground/50 w-6">{max}</span>
      <span className="text-[11px] font-mono text-primary/80 w-5">{value}</span>
    </div>
  );
}

export function UsageBar({ label, used, total, color }: {
  label: string; used: number; total: number; color: string;
}) {
  const pct = Math.round((used / total) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground/70">{label}</span>
        <span className="text-[10px] font-mono" style={{ color }}>{used.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="sp-bar h-full rounded-full" style={{ "--bar-w": `${pct}%`, width: `${pct}%`, background: color } as React.CSSProperties} />
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1 mt-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/45">{children}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

export function ActionBtn({ children, variant = "default", onClick }: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "danger";
  onClick?: () => void;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.85)" },
    primary: { background: "linear-gradient(135deg,#7c8dff,#a78bfa)", border: "none", color: "#fff", boxShadow: "0 0 14px rgba(124,141,255,0.4)" },
    danger:  { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(248,113,113,0.9)" },
  };
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-85 active:scale-95" style={styles[variant]}>
      {children}
    </button>
  );
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div className="sp-toast fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium text-white pointer-events-none" style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
      <Check style={{ width: 13, height: 13, color: "#4ade80" }} />
      {msg}
    </div>
  );
}
