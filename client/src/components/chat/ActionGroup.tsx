/**
 * ActionGroup — smart container for a tool_group message.
 *
 * Routing:
 *   1 action  → direct card (or ToolGroupLine fallback)
 *   2–3       → ActionSummaryBar + individual cards
 *   4+        → ActionSummaryBar + ActionTimeline (collapsed by default)
 *
 * ToolGroupLine is always the fallback for unmapped tools.
 */
import { useState } from "react";
import { renderActionCard } from "./cards/ActionCardRegistry";
import { ActionSummaryBar } from "./cards/ActionSummaryBar";
import { ActionTimeline }   from "./cards/ActionTimeline";
import { ToolGroupLine }    from "./ToolGroupLine";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ActionGroupProps {
  actions:    AgentStreamItem[];
  onOpenFile?: (path: string) => void;
}

export function ActionGroup({ actions, onOpenFile }: ActionGroupProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  if (actions.length === 0) return null;

  // ── Single action ──────────────────────────────────────────────────────────
  if (actions.length === 1) {
    const item = actions[0];
    const tool = String(item.tool ?? "");
    const card = renderActionCard(tool, item, onOpenFile);
    return (
      <div data-testid="action-group-single">
        {card ?? <ToolGroupLine actions={actions} onOpenFile={onOpenFile} />}
      </div>
    );
  }

  // ── 2–3 actions — SummaryBar + inline cards ────────────────────────────────
  if (actions.length <= 3) {
    return (
      <div className="flex flex-col gap-1" data-testid="action-group-small">
        <ActionSummaryBar actions={actions} />
        {actions.map((item, i) => {
          const tool = String(item.tool ?? "");
          const card = renderActionCard(tool, item, onOpenFile);
          return (
            <div key={i}>
              {card ?? <ToolGroupLine actions={[item]} onOpenFile={onOpenFile} />}
            </div>
          );
        })}
      </div>
    );
  }

  // ── 4+ actions — SummaryBar + ActionTimeline ───────────────────────────────
  return (
    <div className="flex flex-col gap-0.5" data-testid="action-group-large">
      <ActionSummaryBar
        actions={actions}
        expanded={summaryExpanded}
        onToggle={() => setSummaryExpanded((v) => !v)}
      />
      <ActionTimeline actions={actions} onOpenFile={onOpenFile} />
    </div>
  );
}
