/**
 * IQ 2000 — Console · ConsolePanel
 *
 * Full intelligent terminal: ANSI colors, runtime state badge,
 * install progress bar, crash overlay, search/filter, copy/clear.
 */

import { useState, useCallback } from "react";
import { Terminal, Wifi, WifiOff, Trash2, Copy, Check, Search, X } from "lucide-react";

import { ConsoleStream }      from "./ConsoleStream";
import { RuntimeBadge }       from "./RuntimeBadge";
import { InstallProgress }    from "./InstallProgress";
import { RuntimeOverlay }     from "./RuntimeOverlay";
import { useConsoleStream }   from "./useConsoleStream";
import { stripAnsi }          from "./ansi-utils";

import type { LogLine, RuntimeState, NpmMeta, RuntimeStateEvent } from "@/types/console";

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_LINES = 2000;

function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }

const WELCOME: LogLine[] = [
  { id:"w1", kind:"system", text:"Console ready — agent output appears here.", ts: new Date().toISOString() },
  { id:"w2", kind:"system", text:"────────────────────────────────────────────────────────", ts: new Date().toISOString() },
];

// ─── Notable state → system line messages ───────────────────────────────────

const STATE_MESSAGES: Partial<Record<RuntimeState, string>> = {
  ready:      "Development server ready.",
  crashed:    "Process crashed.",
  failed:     "Runtime failed to start.",
  recovering: "AI agent attempting recovery…",
  recovered:  "Runtime recovered successfully.",
};

// ─── ConsolePanel ───────────────────────────────────────────────────────────

export function ConsolePanel() {
  const projectId = Number(localStorage.getItem("nura.projectId") || "1") || 1;

  const [lines,        setLines]        = useState<LogLine[]>(WELCOME);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("idle");
  const [stateMsg,     setStateMsg]     = useState("");
  const [lastNpmMeta,  setLastNpmMeta]  = useState<NpmMeta | undefined>();
  const [search,       setSearch]       = useState("");
  const [showSearch,   setShowSearch]   = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [dismissed,    setDismissed]    = useState(false);

  const addLine = useCallback((line: LogLine) => {
    setLines(prev => {
      const next = [...prev, line];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
    if (line.meta?.npm) setLastNpmMeta(line.meta.npm);
  }, []);

  const onState = useCallback((ev: RuntimeStateEvent) => {
    setRuntimeState(ev.state as RuntimeState);
    setStateMsg(ev.message ?? "");
    setDismissed(false);
    const text = STATE_MESSAGES[ev.state as RuntimeState];
    if (text) {
      setLines(prev => [...prev, { id: uid(), kind: "system", text, ts: new Date().toISOString() }]);
    }
  }, []);

  const connected = useConsoleStream(projectId, addLine, onState);

  const handleClear = useCallback(() => {
    setLines(WELCOME);
    setLastNpmMeta(undefined);
    setRuntimeState("idle");
    setStateMsg("");
    setDismissed(false);
  }, []);

  const handleCopy = useCallback(() => {
    const text = lines.map(l => stripAnsi(l.text)).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [lines]);

  const toggleSearch = useCallback(() => {
    setShowSearch(v => { if (v) setSearch(""); return !v; });
  }, []);

  const isInstalling = runtimeState === "installing";
  const showOverlay  = !dismissed && ["crashed","recovering","failed"].includes(runtimeState);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background:"hsl(222,32%,5.5%)", fontFamily:"'JetBrains Mono','Fira Code','Cascadia Code','Menlo',monospace" }}>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2.5">
          <Terminal size={13} className="text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold" style={{ color:"rgba(255,255,255,0.65)" }}>Console</span>
          {connected
            ? <span className="flex items-center gap-1 text-[10px]" style={{ color:"rgba(107,203,119,0.8)" }}><Wifi size={10}/>live</span>
            : <span className="flex items-center gap-1 text-[10px]" style={{ color:"rgba(255,255,255,0.25)" }}><WifiOff size={10}/>connecting…</span>}
          <RuntimeBadge state={runtimeState} message={stateMsg} />
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={toggleSearch} title="Search" className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: showSearch ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)" }}>
            <Search size={12}/>
          </button>
          <button onClick={handleCopy} title="Copy" className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color:"rgba(255,255,255,0.4)" }}>
            {copied ? <Check size={12} className="text-emerald-400"/> : <Copy size={12}/>}
          </button>
          <button onClick={handleClear} title="Clear" className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color:"rgba(255,255,255,0.4)" }}>
            <Trash2 size={12}/>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(0,0,0,0.2)" }}>
          <Search size={11} style={{ color:"rgba(255,255,255,0.3)" }} className="flex-shrink-0"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter logs…" autoFocus
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color:"rgba(255,255,255,0.8)", caretColor:"#4d9de0" }}/>
          {search && <button onClick={() => setSearch("")}><X size={11} style={{ color:"rgba(255,255,255,0.3)" }}/></button>}
        </div>
      )}

      {/* Install progress */}
      <InstallProgress active={isInstalling} lastNpmMeta={lastNpmMeta}/>

      {/* Crash/recovery overlay */}
      {showOverlay && (
        <RuntimeOverlay state={runtimeState} message={stateMsg} onDismiss={() => setDismissed(true)}/>
      )}

      {/* Log stream */}
      <ConsoleStream lines={lines} search={search}/>
    </div>
  );
}
