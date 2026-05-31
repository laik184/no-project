/**
 * ActionTimeline — vertical timeline with status dots, running animation,
 * success/error states, and collapsible sections.
 */
import { useState, useMemo } from "react";
import { ChevronDown, Search, X, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { renderActionCard }     from "./ActionCardRegistry";
import { ToolGroupLine }        from "../ToolGroupLine";
import { TOOL_COLOR_MAP }       from "../tool-maps";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ActionTimelineProps {
  actions:     AgentStreamItem[];
  onOpenFile?: (path: string) => void;
}

function TimelineDot({ status }: { status: AgentStreamItem["status"] }) {
  if (status === "running") {
    return (
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center relative">
        <span className="absolute rounded-full" style={{ width: 12, height: 12, background: "rgba(59,130,246,0.15)", animation: "tl-ping 1.2s ease-out infinite" }} />
        <Loader2 className="animate-spin" style={{ width: 11, height: 11, color: "#3b82f6" }} />
      </div>
    );
  }
  if (status === "done") {
    return (
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        <CheckCircle2 style={{ width: 11, height: 11, color: "#22c55e" }} />
      </div>
    );
  }
  if ((status as string) === "error") {
    return (
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        <XCircle style={{ width: 11, height: 11, color: "#ef4444" }} />
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
      <Circle style={{ width: 8, height: 8, color: "rgba(100,116,139,0.3)" }} />
    </div>
  );
}

const TIMELINE_CSS = `
  @keyframes tl-ping { 0% { transform: scale(1); opacity: 0.8; } 80%,100% { transform: scale(1.9); opacity: 0; } }
  @keyframes tl-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
`;

export function ActionTimeline({ actions, onOpenFile }: ActionTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [query,    setQuery]    = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter((a) => {
      const tool    = String(a.tool    ?? "").toLowerCase();
      const content = String(a.content ?? "").toLowerCase();
      const file    = String((a.meta?.file as string) ?? "").toLowerCase();
      return tool.includes(q) || content.includes(q) || file.includes(q);
    });
  }, [actions, query]);

  return (
    <div data-testid="action-timeline">
      <style>{TIMELINE_CSS}</style>

      {/* Toggle row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] transition-colors hover:bg-white/[0.03] mt-0.5"
        style={{ color: "rgba(100,116,139,0.5)" }}
        data-testid="button-action-timeline-toggle">
        <ChevronDown
          style={{
            width: 11, height: 11,
            transform:  expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }} />
        {expanded ? `Collapse ${actions.length} actions` : `Show ${actions.length} actions`}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ animation: "tl-enter 0.18s ease both" }} data-testid="action-timeline-items">

          {/* Search (4+ actions) */}
          {actions.length >= 4 && (
            <div className="flex items-center gap-1.5 mt-2 mb-2 px-1">
              <div className="flex items-center flex-1 gap-1.5 rounded-md px-2.5 py-1.5"
                style={{ background: "#0b0f14", border: "1px solid #1f2937" }}>
                <Search style={{ width: 10, height: 10, color: "rgba(100,116,139,0.45)", flexShrink: 0 }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by tool, file, or content…"
                  className="flex-1 bg-transparent text-[10px] outline-none"
                  style={{ color: "rgba(203,213,225,0.8)" }}
                  data-testid="input-timeline-search"
                />
                {query && (
                  <button onClick={() => setQuery("")} data-testid="button-timeline-search-clear">
                    <X style={{ width: 10, height: 10, color: "rgba(100,116,139,0.5)" }} />
                  </button>
                )}
              </div>
              {query && (
                <span className="text-[9px] flex-shrink-0" style={{ color: "rgba(100,116,139,0.5)" }}>
                  {filtered.length}/{actions.length}
                </span>
              )}
            </div>
          )}

          {/* Vertical timeline */}
          <div className="relative mt-1.5 pl-4" style={{ borderLeft: "1px solid #1f2937" }}>
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-[10px] text-center"
                style={{ color: "rgba(100,116,139,0.4)" }}>
                No actions match "{query}"
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filtered.map((action, i) => {
                  const tool  = String(action.tool ?? "");
                  const color = TOOL_COLOR_MAP[tool] ?? "#3b82f6";
                  const card  = renderActionCard(tool, action, onOpenFile);
                  return (
                    <div
                      key={i}
                      className="relative flex items-start gap-2"
                      style={{ animationDelay: `${i * 25}ms`, animation: "tl-enter 0.16s ease both" }}>
                      {/* Timeline dot — positioned on the left border */}
                      <div className="absolute -left-5 top-1.5 z-10">
                        <TimelineDot status={action.status} />
                      </div>
                      {/* Card or fallback */}
                      <div className="flex-1 min-w-0">
                        {card ?? <ToolGroupLine actions={[action]} onOpenFile={onOpenFile} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
