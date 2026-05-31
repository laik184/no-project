import { Database, Clock, CheckCircle2, Loader2 } from "lucide-react";
import type { AgentStreamItem } from "@/components/agent/AgentActionFeed";

interface DatabaseCardProps {
  item: AgentStreamItem;
}

function operationLabel(tool: string): string {
  if (tool.includes("migrate")) return "Migration";
  if (tool.includes("push"))    return "Schema push";
  return "Database";
}

export function DatabaseCard({ item }: DatabaseCardProps) {
  const tool       = String(item.tool ?? "db.push");
  const opLabel    = operationLabel(tool);
  const isRunning  = item.status === "running";
  const isDone     = item.status === "done";
  const durationMs = item.meta?.durationMs;

  return (
    <div className="rounded-lg flex items-center gap-2.5 px-3 py-2" data-testid="database-card"
      style={{ background: "#111827", border: "1px solid #1f2937" }}>

      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)" }}>
        <Database style={{ width: 13, height: 13, color: "#34d399" }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium" style={{ color: "rgba(203,213,225,0.9)" }}>
            {opLabel}
          </span>
          {isRunning && <Loader2 className="animate-spin" style={{ width: 11, height: 11, color: "#34d399" }} />}
          {isDone    && <CheckCircle2 style={{ width: 11, height: 11, color: "#22c55e" }} />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9.5px] truncate" style={{ color: "rgba(100,116,139,0.5)" }}>
            {item.content}
          </span>
          {durationMs !== undefined && (
            <span className="flex items-center gap-0.5 text-[9px] flex-shrink-0" style={{ color: "rgba(100,116,139,0.4)" }}>
              <Clock style={{ width: 8, height: 8 }} />
              {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
