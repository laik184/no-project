import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Palette, ImageIcon, Layout, ArrowRight, ExternalLink } from "lucide-react";
import { SiFigma } from "react-icons/si";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ImportLoadingOverlay } from "@/components/import/import-loading-overlay";
import type { FigmaImportResponse } from "@/types/import";

export default function FigmaImport() {
  const [, setLocation] = useLocation();
  const [figmaUrl, setFigmaUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  async function handleImport() {
    if (!figmaUrl.trim()) { setError("Please enter a Figma file URL"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/import/figma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl: figmaUrl.trim(), accessToken: accessToken.trim() || undefined }),
      });
      const data: FigmaImportResponse = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Import failed");
      setImportId(data.importId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setLoading(false);
    }
  }

  const importItems = [
    { icon: Palette, label: "Theme & components", desc: "Colors, fonts, and reusable UI blocks" },
    { icon: ImageIcon, label: "Assets & icons", desc: "Exported images, SVGs, and vectors" },
    { icon: Layout, label: "App scaffolding", desc: "Page structure and layout hierarchy" },
  ];

  if (importId) {
    return (
      <ImportLoadingOverlay
        serviceName="Figma"
        serviceColor="#f24e1e"
        serviceIcon={<SiFigma className="w-9 h-9 text-white" />}
        steps={["Connecting to Figma…", "Reading design file…", "Extracting components…", "Scaffolding React project…", "Finalizing workspace…"]}
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f24e1e] via-[#a259ff] to-[#1abcfe] flex items-center justify-center">
                  <SiFigma className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-semibold text-white" data-testid="heading-figma-import">Import Figma Design</h1>
              </div>
              <p className="text-sm text-muted-foreground">Convert your Figma frames into a live React project.</p>
            </div>
            <a href="#" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 flex-shrink-0" data-testid="button-docs">
              <ExternalLink className="w-3 h-3" /> Docs
            </a>
          </div>
          <div className="h-px bg-white/[0.07] mb-7" />
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Figma File URL</label>
              <input ref={inputRef} type="text" value={figmaUrl} onChange={(e) => { setFigmaUrl(e.target.value); setError(null); }}
                placeholder="https://www.figma.com/file/..." data-testid="input-figma-url"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-muted-foreground/50 outline-none transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.06)", border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)" }}
                onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(124,141,255,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,141,255,0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <p className="text-xs text-muted-foreground">Provide a Personal Access Token below for private files.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Personal Access Token <span className="normal-case font-normal">(optional)</span></label>
                <button onClick={() => setShowToken((v) => !v)} className="text-xs text-primary/70 hover:text-primary transition-colors">{showToken ? "Hide" : "Show"}</button>
              </div>
              <input type={showToken ? "text" : "password"} value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                placeholder="figd_…" data-testid="input-figma-token"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-muted-foreground/40 outline-none transition-all font-mono"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(124,141,255,0.5)"; }}
                onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; }}
              />
            </div>
            <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What we'll import</p>
              {importItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.07] flex items-center justify-center flex-shrink-0 mt-0.5"><Icon className="w-3.5 h-3.5 text-muted-foreground" /></div>
                    <div><p className="text-sm text-white font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f24e1e] via-[#a259ff] to-[#1abcfe] flex items-center justify-center flex-shrink-0"><SiFigma className="w-5 h-5 text-white" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">Connect Figma account</p><p className="text-xs text-muted-foreground">Browse and import frames directly</p></div>
              <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors flex-shrink-0" data-testid="button-login-figma">
                Log in <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="pt-2">
              <button data-testid="button-import-design" onClick={handleImport} disabled={loading || !figmaUrl.trim()}
                className={cn("w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-200", !loading && figmaUrl.trim() ? "hover:opacity-90 active:scale-[0.98]" : "opacity-50 cursor-not-allowed")}
                style={{ background: "linear-gradient(135deg, #7c8dff, #a78bfa)", boxShadow: "0 0 24px rgba(124,141,255,0.35), 0 4px 12px rgba(0,0,0,0.3)" }}>
                {loading ? "Starting…" : "Import Design"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
