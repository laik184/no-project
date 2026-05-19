import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, X, Upload, Link2, Plus, ChevronRight, CheckCircle2, Loader2, FolderOpen, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useImportModal } from "@/context/import-modal-context";
import { categories, importOptions } from "./import-options-data";
import { ZipPhase, FileNode, buildFakeTree, TreeNode, OptionIcon } from "./zip-tree";
import type { ZipImportResponse } from "@/types/import";

export function ImportModal() {
  const { open, closeImport } = useImportModal();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedOption, setSelectedOption] = useState<typeof importOptions[0] | null>(null);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipPhase, setZipPhase] = useState<ZipPhase>("idle");
  const [extractedTree, setExtractedTree] = useState<FileNode[]>([]);
  const [extractProgress, setExtractProgress] = useState(0);
  const [zipError, setZipError] = useState<string | null>(null);
  const [doneProjectId, setDoneProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)); });
      setTimeout(() => searchRef.current?.focus(), 150);
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setMounted(false); setSelectedOption(null); setSearch(""); setSelectedCategory("all");
        setZipFile(null); setZipPhase("idle"); setExtractedTree([]); setExtractProgress(0);
        setZipError(null); setDoneProjectId(null);
      }, 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function handleZipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipFile(file); setZipPhase("processing"); setExtractProgress(0); setZipError(null);
    e.target.value = "";
    try {
      const res = await fetch("/api/import/zip", {
        method: "POST",
        headers: { "Content-Type": "application/zip", "X-Filename": file.name },
        body: file,
      });
      const data: ZipImportResponse = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Extraction failed");
      setExtractProgress(100);
      setExtractedTree(data.tree?.length ? data.tree : buildFakeTree(file.name));
      setDoneProjectId(data.projectId);
      setZipPhase("done");
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Upload failed");
      setZipPhase("error");
    }
  }

  useEffect(() => {
    if (zipPhase !== "processing") return;
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 12 + 4;
      if (p >= 90) { clearInterval(iv); p = 90; }
      setExtractProgress(Math.floor(p));
    }, 200);
    return () => clearInterval(iv);
  }, [zipPhase]);

  function handleOpenInWorkspace() {
    closeImport();
    setLocation(doneProjectId ? `/workspace/${doneProjectId}` : "/workspace?library=true");
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeImport(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeImport]);

  const filtered = importOptions.filter((opt) => {
    const matchesCategory = selectedCategory === "all" || opt.category === selectedCategory;
    const matchesSearch = search.trim() === "" || opt.title.toLowerCase().includes(search.toLowerCase()) || opt.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function handleAction() {
    if (selectedOption?.route) { closeImport(); setLocation(selectedOption.route); }
  }

  const resetZip = () => { setZipFile(null); setZipPhase("idle"); setExtractedTree([]); setExtractProgress(0); setZipError(null); setDoneProjectId(null); };

  function renderZipContent(isMobile = false) {
    if (zipPhase === "idle") return (
      <>
        <div className="rounded-xl p-4 mb-6 text-sm text-muted-foreground leading-relaxed" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>{selectedOption?.detailDescription}</div>
        <div className={cn("flex gap-3", isMobile ? "mt-0" : "mt-auto")}>
          <button onClick={() => zipInputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg, #7c8dff, #a78bfa)", boxShadow: "0 0 20px rgba(124,141,255,0.3)" }} data-testid={isMobile ? "button-action-upload-mobile" : "button-action-upload"}><Upload className="w-4 h-4" />{selectedOption?.actionLabel}</button>
          {!isMobile && <button onClick={() => setSelectedOption(null)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/6 transition-all" style={{ border: "1px solid rgba(255,255,255,0.09)" }} data-testid="button-action-cancel">Cancel</button>}
        </div>
      </>
    );
    if (zipPhase === "processing") return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin text-[#7c8dff]" /><span>Extracting <span className="text-foreground font-medium">{zipFile?.name}</span>…</span></div>
        <div className="rounded-xl overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}><div className="h-1.5 rounded-full" style={{ width: `${extractProgress}%`, background: "linear-gradient(90deg, #7c8dff, #a78bfa)", transition: "width 0.2s ease" }} /></div>
        <p className="text-xs text-muted-foreground">{extractProgress}% — reading archive…</p>
      </div>
    );
    if (zipPhase === "error") return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3 text-sm"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><span className="text-red-400">{zipError}</span></div>
        <button onClick={resetZip} className="w-fit px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" style={{ border: "1px solid rgba(255,255,255,0.09)" }}>Try again</button>
      </div>
    );
    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3 text-sm"><CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" /><span className="text-foreground font-medium">Extracted successfully</span><span className="text-muted-foreground">— {zipFile?.name}</span></div>
        <div className="rounded-xl p-3 mb-5 flex-1 overflow-y-auto text-xs font-mono" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", maxHeight: 180 }}>
          {extractedTree.map((node) => <TreeNode key={node.name} node={node} depth={0} />)}
        </div>
        <div className={cn("flex gap-3", isMobile ? "flex-col" : "mt-auto")}>
          <button onClick={handleOpenInWorkspace} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg, #7c8dff, #a78bfa)", boxShadow: "0 0 20px rgba(124,141,255,0.3)" }} data-testid={isMobile ? "button-open-workspace-mobile" : "button-open-workspace"}><FolderOpen className="w-4 h-4" />Open in Workspace</button>
          <button onClick={resetZip} className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/6 transition-all" style={{ border: "1px solid rgba(255,255,255,0.09)" }} data-testid={isMobile ? "button-upload-another-mobile" : "button-upload-another"}>Upload another</button>
        </div>
      </div>
    );
  }

  if (!mounted) return null;

  return (
    <>
      <div className={cn("fixed inset-0 z-50 transition-all duration-300", visible ? "opacity-100" : "opacity-0")} style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={closeImport} data-testid="import-modal-backdrop" />
      <div className={cn("fixed z-50 inset-0 items-center justify-center hidden md:flex pointer-events-none")}>
        <div className={cn("pointer-events-auto w-full max-w-3xl mx-4 rounded-2xl overflow-hidden transition-all duration-300 border border-white/10", visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4")} style={{ background: "linear-gradient(135deg, hsl(222,30%,9%) 0%, hsl(220,25%,11%) 100%)", boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(124,141,255,0.08)" }} data-testid="import-modal-desktop">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input ref={searchRef} type="text" placeholder="Import anything..." value={search} onChange={(e) => { setSearch(e.target.value); setSelectedOption(null); }} className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none" data-testid="input-import-search" />
            <button onClick={closeImport} className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors" data-testid="button-close-import"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex" style={{ minHeight: 420, maxHeight: "60vh" }}>
            <div className="w-44 flex-shrink-0 border-r border-white/8 py-3 px-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Categories</p>
              {categories.map((cat) => { const Icon = cat.icon; const isActive = selectedCategory === cat.id; return (<button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setSelectedOption(null); }} data-testid={`button-category-${cat.id}`} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-left", isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}><Icon className="w-3.5 h-3.5 flex-shrink-0" />{cat.label}</button>); })}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedOption ? (
                <div className="p-6 flex flex-col h-full">
                  <button onClick={() => { setSelectedOption(null); resetZip(); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit" data-testid="button-back-to-list"><ChevronRight className="w-3 h-3 rotate-180" />Back</button>
                  <div className="flex items-start gap-4 mb-5"><OptionIcon option={selectedOption} /><div><h3 className="text-base font-semibold text-foreground">{selectedOption.title}</h3><p className="text-xs text-muted-foreground mt-0.5">{selectedOption.description}</p></div></div>
                  <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipFileChange} data-testid="input-zip-file" />
                  {selectedOption.id === "zip" ? renderZipContent() : (
                    <>
                      <div className="rounded-xl p-4 mb-6 text-sm text-muted-foreground leading-relaxed" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>{selectedOption.detailDescription}</div>
                      <div className="flex gap-3 mt-auto">
                        <button onClick={handleAction} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg, #7c8dff, #a78bfa)", boxShadow: "0 0 20px rgba(124,141,255,0.3)" }} data-testid="button-action-connect">{selectedOption.action === "create" ? <Plus className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}{selectedOption.actionLabel}</button>
                        <button onClick={() => setSelectedOption(null)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/6 transition-all" style={{ border: "1px solid rgba(255,255,255,0.09)" }} data-testid="button-action-cancel">Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-14 text-muted-foreground"><Search className="w-8 h-8 mb-3 opacity-30" /><p className="text-sm">No results for "{search}"</p></div>) : (
                    filtered.map((opt) => (<button key={opt.id} onClick={() => setSelectedOption(opt)} className={cn("w-full flex items-center gap-4 px-5 py-3.5 text-left transition-all duration-150 group", "hover:bg-white/5 active:bg-white/8")} data-testid={`button-import-option-${opt.id}`}><OptionIcon option={opt} /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground">{opt.title}</p><p className="text-xs text-muted-foreground mt-0.5 truncate">{opt.description}</p></div><ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 transition-colors" /></button>))
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="px-5 py-3 border-t border-white/6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{filtered.length} option{filtered.length !== 1 ? "s" : ""} available</p>
            <p className="text-xs text-muted-foreground">Press <kbd className="px-1.5 py-0.5 rounded bg-white/8 text-[10px] font-mono">Esc</kbd> to close</p>
          </div>
        </div>
      </div>
      <div className={cn("fixed inset-x-0 bottom-0 z-50 md:hidden transition-transform duration-300 ease-out", visible ? "translate-y-0" : "translate-y-full")} style={{ maxHeight: "88dvh" }} data-testid="import-modal-mobile">
        <div className="rounded-t-2xl overflow-hidden flex flex-col" style={{ background: "hsl(222,30%,9%)", boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 0 40px rgba(124,141,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderBottom: "none", maxHeight: "88dvh" }}>
          <div className="flex-shrink-0">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            <div className="flex items-center justify-between px-5 py-3"><h2 className="text-base font-semibold text-foreground">Import</h2><button onClick={closeImport} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors" data-testid="button-close-import-mobile"><X className="w-5 h-5" /></button></div>
            <div className="px-4 pb-3"><div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}><Search className="w-4 h-4 text-muted-foreground flex-shrink-0" /><input type="text" placeholder="Import anything..." value={search} onChange={(e) => { setSearch(e.target.value); setSelectedOption(null); }} className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none" data-testid="input-import-search-mobile" /></div></div>
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">{categories.map((cat) => (<button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setSelectedOption(null); }} data-testid={`button-mobile-category-${cat.id}`} className={cn("flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150", selectedCategory === cat.id ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground border border-white/10 hover:border-white/20 hover:text-foreground")}>{cat.label}</button>))}</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedOption ? (
              <div className="px-5 pt-2 pb-8">
                <button onClick={() => { setSelectedOption(null); resetZip(); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5 py-1" data-testid="button-back-to-list-mobile"><ChevronRight className="w-3 h-3 rotate-180" />Back</button>
                <div className="flex items-start gap-4 mb-4"><OptionIcon option={selectedOption} /><div><h3 className="text-sm font-semibold text-foreground">{selectedOption.title}</h3><p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{selectedOption.description}</p></div></div>
                <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipFileChange} />
                {selectedOption.id === "zip" ? renderZipContent(true) : (
                  <>
                    <div className="rounded-xl p-4 mb-5 text-sm text-muted-foreground leading-relaxed" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>{selectedOption.detailDescription}</div>
                    <button onClick={handleAction} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95" style={{ background: "linear-gradient(135deg, #7c8dff, #a78bfa)", boxShadow: "0 0 20px rgba(124,141,255,0.25)" }} data-testid="button-action-mobile"><Link2 className="w-4 h-4" />{selectedOption.actionLabel}</button>
                  </>
                )}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground"><Search className="w-8 h-8 mb-3 opacity-30" /><p className="text-sm">No results for "{search}"</p></div>
            ) : (
              <div className="divide-y divide-white/5">{filtered.map((opt) => (<button key={opt.id} onClick={() => setSelectedOption(opt)} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:bg-white/8" data-testid={`button-mobile-import-option-${opt.id}`}><OptionIcon option={opt} /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground">{opt.title}</p><p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p></div><ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" /></button>))}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
