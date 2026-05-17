import { useEffect, useRef, useState } from "react";
import { Trash2, RotateCcw, Copy, Check, Terminal, Wifi, WifiOff } from "lucide-react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

type LineKind = "stdout" | "stderr" | "system" | "error";

interface LogLine {
  id: string;
  kind: LineKind;
  text: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

const WELCOME: LogLine[] = [
  { id: "w1", kind: "system", text: "Console connected — agent tool output appears here." },
  { id: "w2", kind: "system", text: "Commands are controlled by the AI agent." },
  { id: "w3", kind: "system", text: "────────────────────────────────────────────────────────" },
];

export function ConsolePanel() {
  const [lines, setLines] = useState<LogLine[]>(WELCOME);
  const [copied, setCopied] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const projectId = Number(window.localStorage.getItem("nura.projectId") || "1") || 1;

  useRealtimeEvent("console", (data) => {
    try {
      const e = data as { stream?: "stdout" | "stderr"; line?: string; projectId?: number };
      if (!e.line) return;
      if (e.projectId !== undefined && e.projectId !== projectId) return;
      setLines((prev) => [
        ...prev,
        { id: uid(), kind: e.stream === "stderr" ? "stderr" : "stdout", text: e.line! },
      ]);
    } catch {}
  });

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/terminal?projectId=${projectId}`);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type: string; data?: unknown };
        if (msg.type === "ready") setWsReady(true);
        if (msg.type === "exit") setWsReady(false);
        if (msg.type === "error") setLines((prev) => [...prev, { id: uid(), kind: "error", text: String(msg.data ?? "terminal error") }]);
      } catch {
      }
    };
    ws.onclose = () => setWsReady(false);
    return () => ws.close();
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const handleClear = () => setLines(WELCOME);
  const handleRestart = () => setLines([...WELCOME, { id: uid(), kind: "system", text: "Console cleared. Agent still controls commands." }]);
  const handleCopy = () => {
    const text = lines.map((l) => `${l.kind === "stdout" ? "" : l.kind === "stderr" ? "! " : ""}${l.text}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "hsl(222,32%,5.5%)", fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code','Menlo',monospace" }}>
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-400" />
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Console</span>
          {wsReady
            ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><Wifi size={11} />live</span>
            : <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}><WifiOff size={11} />idle</span>
          }
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClear}   title="Clear" className="p-1.5 rounded hover:bg-white/10 transition-colors"><Trash2   size={13} style={{ color: "rgba(255,255,255,0.5)" }} /></button>
          <button onClick={handleRestart} title="Restart" className="p-1.5 rounded hover:bg-white/10 transition-colors"><RotateCcw size={13} style={{ color: "rgba(255,255,255,0.5)" }} /></button>
          <button onClick={handleCopy}    title="Copy" className="p-1.5 rounded hover:bg-white/10 transition-colors">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} style={{ color: "rgba(255,255,255,0.5)" }} />}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {lines.map((line) => (
          <div key={line.id} className={`text-xs leading-5 ${line.kind === "stderr" || line.kind === "error" ? "text-red-400" : line.kind === "system" ? "text-blue-400/70" : "text-emerald-300/90"}`}>
            {line.kind === "stderr" && <span className="opacity-60 mr-1">!</span>}
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
