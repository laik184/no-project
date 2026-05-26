import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  X,
  ChevronDown,
  Pause,
  Play,
  FileText,
  Download,
  Trash2,
  Check,
  Copy,
} from "lucide-react";

type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
type LogFilter = "ALL" | LogLevel;

interface LogEntry {
  id: number;
  ts: string;
  level: LogLevel;
  message: string;
}

const LEVEL_STYLE: Record<LogLevel, { badge: string; badgeBg: string; text: string }> = {
  INFO:    { badge: "#94a3b8", badgeBg: "rgba(148,163,184,0.1)", text: "rgba(148,163,184,0.8)"  },
  SUCCESS: { badge: "#4ade80", badgeBg: "rgba(74,222,128,0.1)",  text: "rgba(134,239,172,0.9)"  },
  WARNING: { badge: "#fbbf24", badgeBg: "rgba(251,191,36,0.1)",  text: "rgba(253,224,71,0.85)"  },
  ERROR:   { badge: "#f87171", badgeBg: "rgba(248,113,113,0.1)", text: "rgba(252,165,165,0.9)"  },
};

function makeTs(base: Date, offsetSec: number) {
  const d = new Date(base.getTime() + offsetSec * 1000);
  return d.toTimeString().slice(0, 8);
}

const BASE = new Date();
BASE.setHours(12, 45, 0, 0);

const SEED_LOGS: LogEntry[] = [
  { id:  1, ts: makeTs(BASE,  0), level: "INFO",    message: "Starting deployment pipeline..." },
  { id:  2, ts: makeTs(BASE,  1), level: "INFO",    message: "Allocating compute resources..." },
  { id:  3, ts: makeTs(BASE,  2), level: "SUCCESS", message: "Resources provisioned successfully." },
  { id:  4, ts: makeTs(BASE,  3), level: "INFO",    message: "Running security scan on dependencies..." },
  { id:  5, ts: makeTs(BASE,  5), level: "WARNING", message: "lodash@4.17.20 has 1 low-severity advisory." },
  { id:  6, ts: makeTs(BASE,  6), level: "SUCCESS", message: "Security scan passed. No critical issues found." },
  { id:  7, ts: makeTs(BASE,  7), level: "INFO",    message: "Installing dependencies (npm ci)..." },
  { id:  8, ts: makeTs(BASE,  9), level: "INFO",    message: "Running build script: npm run build" },
  { id:  9, ts: makeTs(BASE, 11), level: "INFO",    message: "Compiling TypeScript..." },
  { id: 10, ts: makeTs(BASE, 13), level: "INFO",    message: "Optimizing and minifying assets..." },
  { id: 11, ts: makeTs(BASE, 15), level: "SUCCESS", message: "Build completed in 12.4s  (847KB → 213KB gzipped)" },
  { id: 12, ts: makeTs(BASE, 16), level: "INFO",    message: "Bundling assets for production..." },
  { id: 13, ts: makeTs(BASE, 17), level: "INFO",    message: "Generating source maps..." },
  { id: 14, ts: makeTs(BASE, 18), level: "SUCCESS", message: "Bundle ready. Output: dist/" },
  { id: 15, ts: makeTs(BASE, 19), level: "INFO",    message: "Pushing image to container registry..." },
  { id: 16, ts: makeTs(BASE, 21), level: "INFO",    message: "Routing traffic to new deployment..." },
  { id: 17, ts: makeTs(BASE, 22), level: "INFO",    message: "Running health checks on /health..." },
  { id: 18, ts: makeTs(BASE, 23), level: "ERROR",   message: "Health check failed: connection refused on port 3000." },
  { id: 19, ts: makeTs(BASE, 24), level: "WARNING", message: "Retrying health check (attempt 2 of 3)..." },
  { id: 20, ts: makeTs(BASE, 25), level: "SUCCESS", message: "Health check passed. Service is healthy." },
  { id: 21, ts: makeTs(BASE, 26), level: "SUCCESS", message: "Deployment promoted to production. App is live 🚀" },
];

export function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let i = 0;
    const push = () => {
      if (i >= SEED_LOGS.length) return;
      setLogs((prev) => [...prev, SEED_LOGS[i++]]);
      timerRef.current = setTimeout(push, 320 + Math.random() * 280);
    };
    timerRef.current = setTimeout(push, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setAutoScroll(atBottom);
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (filter !== "ALL" && l.level !== filter) return false;
    if (search.trim() && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const copyLine = (entry: LogEntry) => {
    navigator.clipboard.writeText(`[${entry.ts}] ${entry.level}: ${entry.message}`);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const downloadLogs = () => {
    const text = logs.map((l) => `[${l.ts}] ${l.level}: ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "deployment.log"; a.click();
    URL.revokeObjectURL(url);
  };

  const FILTERS: LogFilter[] = ["ALL", "INFO", "SUCCESS", "WARNING", "ERROR"];

  return (
    <div className="flex flex-col h-full gap-0" style={{ minHeight: 0 }}>
      <style>{`
        @keyframes log-row-in {
          from { opacity: 0; transform: translateX(-3px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .log-row-anim { animation: log-row-in 0.18s ease; }
        .log-copy-btn { opacity: 0; transition: opacity 0.12s; }
        .log-row:hover .log-copy-btn { opacity: 1; }
      `}</style>

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Search className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(100,116,139,0.6)" }} />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-[rgba(100,116,139,0.5)] min-w-0"
            style={{ color: "rgba(226,232,240,0.85)" }}
            data-testid="input-search-logs"
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: "rgba(100,116,139,0.5)" }}>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: filter === "ALL" ? "rgba(148,163,184,0.8)" : LEVEL_STYLE[filter as LogLevel].badge }}
            data-testid="button-filter-logs"
          >
            {filter}
            <ChevronDown className="h-3 w-3" style={{ opacity: 0.6 }} />
          </button>
          {filterOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden py-1"
              style={{ background: "hsl(222,30%,9%)", border: "1px solid rgba(255,255,255,0.1)", minWidth: "110px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
            >
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setFilterOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-all duration-100"
                  style={{
                    color: f === "ALL" ? "rgba(148,163,184,0.8)" : LEVEL_STYLE[f as LogLevel].badge,
                    background: filter === f ? "rgba(255,255,255,0.05)" : "transparent",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = filter === f ? "rgba(255,255,255,0.05)" : "transparent"; }}
                  data-testid={`filter-option-${f.toLowerCase()}`}
                >
                  {f !== "ALL" && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: LEVEL_STYLE[f as LogLevel].badge }} />
                  )}
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll((v) => !v)}
          title={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11.5px] transition-all duration-150 flex-shrink-0"
          style={{
            background: autoScroll ? "rgba(124,141,255,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${autoScroll ? "rgba(124,141,255,0.25)" : "rgba(255,255,255,0.08)"}`,
            color: autoScroll ? "#a78bfa" : "rgba(100,116,139,0.6)",
          }}
          data-testid="button-toggle-autoscroll"
        >
          {autoScroll ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>

        {/* Download */}
        <button
          onClick={downloadLogs}
          title="Download logs"
          disabled={logs.length === 0}
          className="p-1.5 rounded-lg transition-all duration-150 flex-shrink-0"
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: logs.length ? "rgba(148,163,184,0.6)" : "rgba(100,116,139,0.3)",
            cursor: logs.length ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => { if (logs.length) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          data-testid="button-download-logs"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        {/* Clear */}
        <button
          onClick={() => setLogs([])}
          title="Clear logs"
          disabled={logs.length === 0}
          className="p-1.5 rounded-lg transition-all duration-150 flex-shrink-0"
          style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: logs.length ? "rgba(248,113,113,0.6)" : "rgba(100,116,139,0.3)",
            cursor: logs.length ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => { if (logs.length) (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          data-testid="button-clear-logs"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Log count */}
      {logs.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-3 mb-2">
          {(["INFO","SUCCESS","WARNING","ERROR"] as LogLevel[]).map((level) => {
            const count = logs.filter((l) => l.level === level).length;
            if (!count) return null;
            const s = LEVEL_STYLE[level];
            return (
              <button
                key={level}
                onClick={() => setFilter(filter === level ? "ALL" : level)}
                className="flex items-center gap-1 text-[10.5px] font-medium transition-all duration-150"
                style={{ color: filter === level ? s.badge : "rgba(100,116,139,0.5)" }}
                data-testid={`count-badge-${level.toLowerCase()}`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.badge, opacity: filter === level ? 1 : 0.5 }} />
                {count} {level}
              </button>
            );
          })}
          <span className="ml-auto text-[10.5px]" style={{ color: "rgba(100,116,139,0.4)" }}>
            {filteredLogs.length} / {logs.length} entries
          </span>
        </div>
      )}

      {/* Terminal */}
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
                  style={{
                    background: isEven ? "transparent" : "rgba(255,255,255,0.015)",
                  }}
                  onMouseEnter={() => setHoveredId(entry.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  data-testid={`log-entry-${entry.id}`}
                >
                  {/* Timestamp */}
                  <span className="flex-shrink-0 select-none mr-2" style={{ color: "rgba(100,116,139,0.45)", minWidth: "60px" }}>
                    {entry.ts}
                  </span>

                  {/* Level badge */}
                  <span
                    className="flex-shrink-0 px-1.5 py-px rounded text-[9.5px] font-bold mr-2 tracking-wide"
                    style={{
                      background: s.badgeBg,
                      color: s.badge,
                      minWidth: "58px",
                      textAlign: "center",
                      display: "inline-block",
                    }}
                  >
                    {entry.level}
                  </span>

                  {/* Message */}
                  <span className="flex-1 min-w-0 break-words" style={{ color: s.text }}>
                    {entry.message}
                  </span>

                  {/* Copy button */}
                  <button
                    onClick={() => copyLine(entry)}
                    className="log-copy-btn flex-shrink-0 ml-2 p-0.5 rounded transition-colors duration-100"
                    style={{
                      color: copiedId === entry.id ? "#4ade80" : "rgba(100,116,139,0.45)",
                      opacity: hoveredId === entry.id ? 1 : 0,
                    }}
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
    </div>
  );
}
