import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Globe, Lock, Download, ExternalLink, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ImportLoadingOverlay } from "@/components/import/import-loading-overlay";
import type { GitImportResponse } from "@/types/import";

export default function BoltImport() {
  const [, setLocation] = useLocation();
  const [repoUrl, setRepoUrl] = useState("");
  const [owner, setOwner] = useState("xzygeu058");
  const [privacy, setPrivacy] = useState("private");
  const [importId, setImportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function handleImport() {
    if (!repoUrl.trim()) { setError("Please enter a GitHub repository URL"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/import/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim(), visibility: privacy, source: "Bolt" }),
      });
      const data: GitImportResponse = await res.json();
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
        serviceName="Bolt"
        serviceColor="#4a90e2"
        serviceIcon={<svg viewBox="0 0 24 24" fill="white" className="w-9 h-9"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" /></svg>}
        steps={["Connecting to Bolt…", "Fetching prototype code…", "Migrating components…", "Setting up environment…", "Preparing workspace…"]}
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
                <div className="w-9 h-9 rounded-xl bg-[#4a90e2] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" /></svg>
                </div>
                <h1 className="text-2xl font-semibold text-white" data-testid="heading-bolt-import">Import from Bolt</h1>
              </div>
              <p className="text-sm text-muted-foreground">Export your Bolt prototype via GitHub and import it here.</p>
            </div>
            <a href="#" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 flex-shrink-0">
              <ExternalLink className="w-3 h-3" /> Docs
            </a>
          </div>
          <div className="h-px bg-white/[0.07] mb-7" />
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">GitHub Repository URL</label>
              <input ref={inputRef} type="text" value={repoUrl} onChange={(e) => { setRepoUrl(e.target.value); setError(null); }}
                placeholder="https://github.com/username/repository" data-testid="input-repo-url"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 outline-none transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(124,141,255,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,141,255,0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                onKeyDown={(e) => { if (e.key === "Enter") handleImport(); }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <p className="text-xs text-muted-foreground">Export from Bolt → GitHub, then paste the repo URL above.</p>
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
            <div className="pt-2">
              <button data-testid="button-import-bolt" onClick={handleImport} disabled={loading || !repoUrl.trim()}
                className={cn("w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-200", !loading && repoUrl.trim() ? "hover:opacity-90 active:scale-[0.98]" : "opacity-50 cursor-not-allowed")}
                style={{ background: "linear-gradient(135deg, #7c8dff, #a78bfa)", boxShadow: "0 0 24px rgba(124,141,255,0.35), 0 4px 12px rgba(0,0,0,0.3)" }}>
                <Download className="w-4 h-4" /> {loading ? "Starting…" : "Import from Bolt"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
