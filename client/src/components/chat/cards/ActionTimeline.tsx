/**
 * ActionTimeline — expandable list of action cards for 4+ actions.
 * Default state: collapsed (only SummaryBar shows above).
 * Expanded: renders each action's specific card or ToolGroupLine fallback.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { renderActionCard } from "./ActionCardRegistry";
import { ToolGroupLine } from "../ToolGroupLine";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface ActionTimelineProps {
  actions:    AgentStreamItem[];
  onOpenFile?: (path: string) => void;
}

export function ActionTimeline({ actions, onOpenFile }: ActionTimelineProps) {
  const [expanded, setExpanded] = useState(false);

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
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }} />
        {expanded ? `Collapse ${actions.length} actions` : `Show ${actions.length} actions`}
      </button>

      {/* Cards */}
      {expanded && (
        <div className="flex flex-col gap-1.5 mt-1.5" data-testid="action-timeline-items">
          {actions.map((action, i) => {
            const tool = String(action.tool ?? "");
            const card = renderActionCard(tool, action, onOpenFile);
            return (
              <div key={i}>
                {card ?? <ToolGroupLine actions={[action]} onOpenFile={onOpenFile} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
