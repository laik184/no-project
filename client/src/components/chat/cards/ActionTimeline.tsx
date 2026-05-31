/**
 * ActionTimeline — Phase 3 (T5): search/filter added to the expanded state.
 * Existing collapse/expand and card rendering logic preserved unchanged.
 */
import { useState, useMemo }    from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { renderActionCard }      from "./ActionCardRegistry";
import { ToolGroupLine }         from "../ToolGroupLine";
import type { AgentStreamItem }  from "@/components/agent/AgentActionFeed";

interface ActionTimelineProps {
  actions:     AgentStreamItem[];
  onOpenFile?: (path: string) => void;
}

export function ActionTimeline({ actions, onOpenFile }: ActionTimelineProps) {
  const [expanded,  setExpanded]  = useState(false);
  const [query,     setQuery]     = useState("");

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
      {/* Toggle row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md text-[10px] transition-colors hover:bg-white/[0.03] mt-0.5"
        style={{ color: "rgba(100,116,139,0.5)" }}
        data-testid="button-action-timeline-toggle">
        <ChevronDown
          style={{
            width: 11, height: 11,
            transform:  expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }} />
        {expanded
          ? `Collapse ${actions.length} actions`
          : `Show ${actions.length} actions`}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div data-testid="action-timeline-items">
          {/* T5 — Search bar (only shown when there are enough actions) */}
          {actions.length >= 4 && (
            <div className="flex items-center gap-1.5 mt-1.5 mb-1.5 px-1"
              style={{ animation: "card-enter 0.15s ease both" }}>
              <div className="flex items-center flex-1 gap-1.5 rounded-md px-2 py-1"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
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

          {/* Action cards with stagger animation */}
          <div className="flex flex-col gap-1.5 mt-1.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-[10px] text-center"
                style={{ color: "rgba(100,116,139,0.4)" }}>
                No actions match "{query}"
              </p>
            ) : (
              filtered.map((action, i) => {
                const tool = String(action.tool ?? "");
                const card = renderActionCard(tool, action, onOpenFile);
                return (
                  <div
                    key={i}
                    style={{ animationDelay: `${i * 30}ms`, animation: "card-enter 0.18s ease both" }}>
                    {card ?? <ToolGroupLine actions={[action]} onOpenFile={onOpenFile} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
