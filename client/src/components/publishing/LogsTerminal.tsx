import { FileText, Check, Copy } from "lucide-react";
import { type LogEntry, LEVEL_STYLE, SEED_LOGS } from "./logs-tab-data";

interface LogsTerminalProps {
  logs: LogEntry[];
  filteredLogs: LogEntry[];
  containerRef: React.RefObject<HTMLDivElement>;
  handleScroll: () => void;
  logEndRef: React.RefObject<HTMLDivElement>;
  hoveredId: number | null;
  setHoveredId: (id: number | null) => void;
  copiedId: number | null;
  copyLine: (entry: LogEntry) => void;
}

export function LogsTerminal({ logs, filteredLogs, containerRef, handleScroll, logEndRef, hoveredId, setHoveredId, copiedId, copyLine }: LogsTerminalProps) {
  return (
    <div
      className="flex-1 rounded-xl overflow-hidden flex flex-col min-h-0"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.3)" }}
    >
      {/* Terminal titlebar */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        {["#f87171","#fbbf24","#4ade80"].map((c) => (
          <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.45 }} />
        ))}
        <FileText className="h-3 w-3 ml-2" style={{ color: "rgba(100,116,139,0.45)" }} />
        <span className="text-[10.5px] font-mono" style={{ color: "rgba(100,116,139,0.5)" }}>deployment.log</span>
        {logs.length < SEED_LOGS.length && (
          <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: "rgba(167,139,250,0.6)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#a78bfa", animation: "pulse 1.2s ease-in-out infinite" }} />
            streaming
          </span>
        )}
      </div>

      {/* Log rows */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-1.5 font-mono text-[11.5px] leading-relaxed min-h-0"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}
        data-testid="logs-container"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12" style={{ color: "rgba(100,116,139,0.4)" }}>
            <FileText className="h-7 w-7 opacity-25" />
            <p className="text-[12px]">
              {logs.length === 0 ? "No logs yet" : "No logs match your filter"}
            </p>
          </div>
        ) : (
          filteredLogs.map((entry, i) => {
            const s = LEVEL_STYLE[entry.level];
            const isEven = i % 2 === 0;
            return (
              <div
                key={entry.id}
                className="log-row log-row-anim flex items-start gap-0 group px-3 py-0.5 transition-colors duration-75"
                style={{ background: isEven ? "transparent" : "rgba(255,255,255,0.015)" }}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                data-testid={`log-entry-${entry.id}`}
              >
                <span className="flex-shrink-0 select-none mr-2" style={{ color: "rgba(100,116,139,0.45)", minWidth: "60px" }}>
                  {entry.ts}
                </span>
                <span
                  className="flex-shrink-0 px-1.5 py-px rounded text-[9.5px] font-bold mr-2 tracking-wide"
                  style={{ background: s.badgeBg, color: s.badge, minWidth: "58px", textAlign: "center", display: "inline-block" }}
                >
                  {entry.level}
                </span>
                <span className="flex-1 min-w-0 break-words" style={{ color: s.text }}>
                  {entry.message}
                </span>
                <button
                  onClick={() => copyLine(entry)}
                  className="log-copy-btn flex-shrink-0 ml-2 p-0.5 rounded transition-colors duration-100"
                  style={{ color: copiedId === entry.id ? "#4ade80" : "rgba(100,116,139,0.45)", opacity: hoveredId === entry.id ? 1 : 0 }}
                  title="Copy line"
                  data-testid={`button-copy-log-${entry.id}`}
                >
                  {copiedId === entry.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
