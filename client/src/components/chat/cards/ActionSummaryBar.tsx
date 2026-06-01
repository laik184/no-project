/**
 * ActionSummaryBar — professional Replit-style action strip.
 * Shows tool icons in contained icon wells, action count, and status badges.
 */
import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { TOOL_ICON_MAP, TOOL_COLOR_MAP } from "../tool-maps";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ActionSummaryBarProps {
  actions:   AgentStreamItem[];
  expanded?: boolean;
  onToggle?: () => void;
}

function StatusBadge({ count, variant, label }: { count: number; variant: "running" | "error" | "done"; label: string }) {
  if (count === 0) return null;
  const styles = {
    running: { bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)",  color: "#3b82f6"  },
    error:   { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   color: "#ef4444"  },
    done:    { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)",   color: "#22c55e"  },
  }[variant];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.color }}>
      {variant === "running" && (
        <Loader2 style={{ width: 8, height: 8 }} className="animate-spin" />
      )}
      {count} {label}
    </span>
  );
}

export function ActionSummaryBar({ actions, expanded, onToggle }: ActionSummaryBarProps) {
  const running = actions.filter((a) => a.status === "running").length;
  const failed  = actions.filter((a) => (a.status as string) === "error").length;
  const done    = actions.filter((a) => a.status === "done").length;

  const durations = actions
    .map((a) => a.meta?.durationMs)
    .filter((d): d is number => d !== undefined);
  const totalMs = durations.reduce((s, d) => s + d, 0);

  const seen = new Set<string>();
  const iconTools: string[] = [];
  for (const a of actions) {
    const t = a.tool ?? "analysis.think";
    if (!seen.has(String(t))) { seen.add(String(t)); iconTools.push(String(t)); }
    if (iconTools.length >= 4) break;
  }

  const hasCounts = running > 0 || failed > 0 || done > 0;

  return (
    <button
      onClick={onToggle}
      className="group flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
      style={{ background: "#111827", border: "1px solid #1f2937" }}
      data-testid="action-summary-bar">

      {/* Icon wells */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {iconTools.map((tool, i) => {
          const Icon  = TOOL_ICON_MAP[tool] ?? Brain;
          const color = TOOL_COLOR_MAP[tool] ?? "#3b82f6";
          return (
            <div key={i}
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}30`, border: `1px solid ${color}60` }}>
              <Icon style={{ width: 11, height: 11, color, strokeWidth: 2 }} />
            </div>
          );
        })}
        {actions.length > 4 && (
          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.12)" }}>
            <span className="text-[8px] font-mono" style={{ color: "rgba(148,163,184,0.5)" }}>
              +{actions.length - 4}
            </span>
          </div>
        )}
      </div>

      <div className="w-px h-3.5 flex-shrink-0" style={{ background: "#1f2937" }} />

      {/* Action count */}
      <span className="text-[11px] font-medium flex-1" style={{ color: "#94a3b8" }}>
        {actions.length} action{actions.length !== 1 ? "s" : ""}
      </span>

      {/* Status badges */}
      {hasCounts && (
        <div className="flex items-center gap-1">
          <StatusBadge count={running} variant="running" label="running" />
          <StatusBadge count={failed}  variant="error"   label="failed"  />
          <StatusBadge count={done}    variant="done"    label="done"    />
        </div>
      )}

      {/* Duration */}
      {totalMs > 0 && (
        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: "rgba(100,116,139,0.45)" }}>
          {totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`}
        </span>
      )}

      {/* Chevron */}
      {onToggle && (
        <ChevronDown
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
          style={{
            width: 12, height: 12,
            color: "rgba(148,163,184,0.5)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s, opacity 0.15s",
          }} />
      )}
    </button>
  );
}
