import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Globe, Lock, Download, ExternalLink, Check, Key, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ImportLoadingOverlay } from "@/components/import/import-loading-overlay";

interface Base44Response { ok: boolean; importId: string; projectId: number; error?: string; }

const HOW_IT_WORKS = [
  { num: 1, title: "Open your Base44 project", desc: "Go to your Base44 dashboard and open the project you want to migrate." },
  { num: 2, title: 'Click "Export to Replit"', desc: 'In your project settings, choose Export → Replit to generate a migration token.' },
  { num: 3, title: "Paste your token below", desc: "Copy the token from Base44 and paste it in the field below to start the import." },
];

export default function Base44Import() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [owner, setOwner] = useState("xzygeu058");
  const [privacy, setPrivacy] = useState("private");
  const [activeStep, setActiveStep] = useState(0);
  const [importId, setImportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => tokenRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function handleImport() {
    if (!token.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/import/base44", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), projectUrl: projectUrl.trim() || undefined, visibility: privacy }),
      });
      const data: Base44Response = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Import failed");
      setImportId(data.importId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setLoading(false);
    }
  }

  if (importId) {
    return (
      <ImportLoadingOverlay
        serviceName="Base44"
        serviceColor="#7c8dff"
        serviceIcon={<svg viewBox="0 0 24 24" fill="none" className="w-9 h-9"><rect width="24" height="24" rx="6" fill="white" fillOpacity="0.15" /><text x="12" y="16" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold" fontFamily="sans-serif">44</text></svg>}
        steps={["Validating token…", "Connecting to Base44…", "Migrating app data…", "Importing schemas…", "Finalizing workspace…"]}
        importId={importId}
        onDone={(projectId) => setLocation(`/workspace/${projectId}`)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto text-white" style={{ background: "hsl(222,30%,7%)" }}>
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.07]" style={{ background: "hsl(222,30%,7%)" }}>
        <div className="flex h-14 items-center px-4 gap-3">
          <button data-testid="button-back" onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        </div>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8 sm:py-14">
        <div className="w-full max-w-lg">
          <div className="flex items-start justify-between mb-7">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#2d2d2d] border border-white/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><circle cx="12" cy="12" r="10" /><text x="12" y="16" textAnchor="middle" fontSize="9" fill="#1a1a1a" fontWeight="bold">44</text></svg>
                </div>
                <h1 className="text-2xl font-semibold text-white" data-testid="heading-base44-import">Import from Base44</h1>
              </div>
              <p className="text-sm text-muted-foreground">Migrate your Base44 project and make it production-ready.</p>
            </div>
            <a href="https://base44.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 flex-shrink-0">
              <ExternalLink className="w-3 h-3" /> Docs
            </a>
          </div>
          <div className="h-px bg-white/[0.07] mb-7" />

          <div className="mb-7">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">How it works</p>
            <div className="space-y-0">
              {HOW_IT_WORKS.map((step, i) => (
                <button key={step.num} onClick={() => setActiveStep(i)} data-testid={`step-${step.num}`}
                  className={cn("w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-150", activeStep === i ? "bg-white/[0.05]" : "hover:bg-white/[0.03]")}>
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 transition-all", activeStep === i ? "bg-primary text-white" : "bg-white/10 text-muted-foreground")}>{step.num}</div>
                  <div>
                    <p className={cn("text-sm font-medium transition-colors", activeStep === i ? "text-white" : "text-muted-foreground")}>{step.title}</p>
                    {activeStep === i && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/[0.07] mb-7" />
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Migration Token</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                <input ref={tokenRef} type="text" value={token} onChange={(e) => { setToken(e.target.value); setError(null); }}
                  placeholder="b44_tok_xxxxxxxxxxxxxxxxxxxxxxxx" data-testid="input-token"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-muted-foreground/40 outline-none transition-all duration-150 font-mono"
                  style={{ background: "rgba(255,255,255,0.06)", border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)" }}
                  onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(124,141,255,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,141,255,0.1)"; }}
                  onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <p className="text-xs text-muted-foreground">Generate from Base44 → Project Settings → Export → Replit.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project URL <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
              <input type="text" value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://app.base44.com/projects/my-project" data-testid="input-project-url"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-muted-foreground/40 outline-none transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(124,141,255,0.5)"; }}
                onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger data-testid="select-owner" className="rounded-xl text-white h-11" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">{owner[0]?.toUpperCase()}</div>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent style={{ background: "hsl(222,30%,10%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <SelectItem value="xzygeu058" className="text-white">xzygeu058</SelectItem>
                  <SelectItem value="other-user" className="text-white">other-user</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visibility</label>
              <div className="grid grid-cols-2 gap-3">
                {[{ value: "public", label: "Public", icon: Globe, desc: "Anyone can view and fork" }, { value: "private", label: "Private", icon: Lock, desc: "Only you can access" }].map((opt) => {
                  const Icon = opt.icon; const active = privacy === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setPrivacy(opt.value)} data-testid={`radio-${opt.value}`} className={cn("flex flex-col gap-2 p-4 rounded-xl text-left transition-all duration-150", active ? "border border-primary/50 bg-primary/10" : "border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Icon className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-muted-foreground")} /><span className={cn("text-sm font-medium", active ? "text-white" : "text-muted-foreground")}>{opt.label}</span></div>
                        {active && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(124,141,255,0.06)", border: "1px solid rgba(124,141,255,0.15)" }}>
              <div className="flex items-center gap-2 mb-3"><Sparkles className="w-3.5 h-3.5 text-primary" /><p className="text-xs font-semibold text-primary uppercase tracking-wider">What gets migrated</p></div>
              {["All your app pages and components", "Database schemas and records", "API integrations and environment variables", "Custom logic and business rules"].map((item) => (
                <div key={item} className="flex items-center gap-2"><Check className="w-3 h-3 text-primary flex-shrink-0" /><p className="text-xs text-muted-foreground">{item}</p></div>
              ))}
            </div>
            <div className="pt-2">
              <button data-testid="button-import-base44" onClick={handleImport} disabled={loading || !token.trim()}
                className={cn("w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-200", token.trim() && !loading ? "hover:opacity-90 active:scale-[0.98]" : "opacity-40 cursor-not-allowed")}
                style={{ background: "linear-gradient(135deg, #7c8dff, #a78bfa)", boxShadow: token.trim() ? "0 0 24px rgba(124,141,255,0.35), 0 4px 12px rgba(0,0,0,0.3)" : "none" }}>
                <Download className="w-4 h-4" /> {loading ? "Starting…" : "Import from Base44"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
