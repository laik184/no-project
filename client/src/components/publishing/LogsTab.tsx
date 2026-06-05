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
import { type LogLevel, type LogFilter, type LogEntry, LEVEL_STYLE, SEED_LOGS } from "./logs-tab-data";
import { LogsTerminal } from "./LogsTerminal";

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

      <LogsTerminal
        logs={logs}
        filteredLogs={filteredLogs}
        containerRef={containerRef}
        handleScroll={handleScroll}
        logEndRef={logEndRef}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        copiedId={copiedId}
        copyLine={copyLine}
      />
    </div>
  );
}
