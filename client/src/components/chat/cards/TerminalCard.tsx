import { useState, useRef, useEffect } from "react";
import { TerminalSquare, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

function exitBadge(code: number) {
  const ok = code === 0;
  return (
    <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
      style={{ background: ok ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: ok ? "#4ade80" : "#f87171", border: `1px solid ${ok ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}` }}>
      {ok ? <CheckCircle2 style={{ width: 9, height: 9 }} /> : <XCircle style={{ width: 9, height: 9 }} />}
      exit {code}
    </span>
  );
}

interface TerminalCardProps {
  item: AgentStreamItem;
}

export function TerminalCard({ item }: TerminalCardProps) {
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const command = item.meta?.file ?? item.content;
  const stdout  = item.meta?.stdout ?? (item.meta?.logs ? item.meta.logs.split("\n") : []);
  const exitCode = item.meta?.exitCode;
  const durationMs = item.meta?.durationMs;

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [stdout.length]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(stdout.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="rounded-lg overflow-hidden" data-testid="terminal-card"
      style={{ background: "rgba(163,230,53,0.04)", border: "1px solid rgba(163,230,53,0.14)" }}>

      {/* Command header */}
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(163,230,53,0.09)" }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(163,230,53,0.1)", border: "1px solid rgba(163,230,53,0.2)" }}>
          <TerminalSquare style={{ width: 12, height: 12, color: "#a3e635" }} />
        </div>
        <span className="flex-1 text-[11px] font-mono truncate" style={{ color: "rgba(163,230,53,0.9)" }}>
          <span style={{ color: "rgba(163,230,53,0.4)" }}>$ </span>{command}
        </span>
      </div>

      {/* Output area */}
      {stdout.length > 0 && (
        <div ref={outputRef}
          className="overflow-y-auto text-[9.5px] font-mono leading-relaxed px-3 py-2"
          style={{ maxHeight: 140, background: "rgba(0,0,0,0.35)", color: "rgba(148,163,184,0.75)", whiteSpace: "pre-wrap", overflowX: "hidden" }}>
          {stdout.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {exitCode !== undefined && exitBadge(exitCode)}
        {durationMs !== undefined && (
          <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(100,116,139,0.5)" }}>
            <Clock style={{ width: 9, height: 9 }} />
            {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
          </span>
        )}
        <div className="flex-1" />
        {stdout.length > 0 && (
          <button onClick={handleCopy}
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors hover:bg-white/[0.06]"
            style={{ color: copied ? "#4ade80" : "rgba(100,116,139,0.5)" }}
            data-testid="button-terminal-copy">
            <Copy style={{ width: 9, height: 9 }} />
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}
