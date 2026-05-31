/**
 * ActionSummaryBar — compact header row for a group of actions.
 * Phase 9: shows running/failed/done counts + duration badges.
 */
import { Brain } from "lucide-react";
import { TOOL_ICON_MAP, TOOL_COLOR_MAP } from "../tool-maps";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ActionSummaryBarProps {
  actions:  AgentStreamItem[];
  expanded?: boolean;
  onToggle?: () => void;
}

function CountBadge({ count, color, label }: { count: number; color: string; label: string }) {
  if (count === 0) return null;
  return (
    <span className="text-[9px] font-mono px-1 py-0.5 rounded"
      style={{ background: `${color}10`, border: `1px solid ${color}22`, color: `${color}bb` }}
      title={`${count} ${label}`}>
      {count} {label[0]}
    </span>
  );
}

export function ActionSummaryBar({ actions, expanded, onToggle }: ActionSummaryBarProps) {
  const running  = actions.filter((a) => a.status === "running").length;
  const failed   = actions.filter((a) => (a.status as string) === "error").length;
  const done     = actions.filter((a) => a.status === "done").length;

  const durations = actions
    .map((a) => a.meta?.durationMs)
    .filter((d): d is number => d !== undefined);
  const totalMs = durations.reduce((s, d) => s + d, 0);

  const seen = new Set<string>();
  const iconTools: string[] = [];
  for (const a of actions) {
    const t = a.tool ?? "analysis.think";
    if (!seen.has(String(t))) { seen.add(String(t)); iconTools.push(String(t)); }
    if (iconTools.length >= 5) break;
  }

  const hasCounts = running > 0 || failed > 0 || done > 0;

  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full text-left rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/[0.03]"
      style={{ background: "#111827", border: "1px solid #263244" }}
      data-testid="action-summary-bar">

      <div className="flex items-center gap-1">
        {iconTools.map((tool, i) => {
          const Icon  = TOOL_ICON_MAP[tool] ?? Brain;
          const color = TOOL_COLOR_MAP[tool] ?? "#3B82F6";
          return <Icon key={i} style={{ width: 11, height: 11, color, flexShrink: 0, strokeWidth: 1.6 }} />;
        })}
        {actions.length > 5 && (
          <span className="text-[9px]" style={{ color: "rgba(100,116,139,0.45)" }}>
            +{actions.length - 5}
          </span>
        )}
      </div>

      <span style={{ color: "rgba(100,116,139,0.25)", fontSize: 10, userSelect: "none" }}>·</span>

      <span className="text-[11px] flex-1" style={{ color: "#94A3B8" }}>
        {actions.length} action{actions.length !== 1 ? "s" : ""}
      </span>

      {hasCounts && (
        <div className="flex items-center gap-1">
          <CountBadge count={running} color="#3B82F6" label="running" />
          <CountBadge count={failed}  color="#EF4444" label="failed"  />
          <CountBadge count={done}    color="#22C55E" label="done"    />
        </div>
      )}

      {totalMs > 0 && (
        <span className="text-[9px] font-mono" style={{ color: "rgba(100,116,139,0.4)" }}>
          {totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`}
        </span>
      )}
    </button>
  );
}
