import { useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle, ChevronDown, Brain, AlertTriangle } from "lucide-react";
import type { PlanData, PlanStepStatus } from "../types";

interface PlanningCardProps {
  plan: PlanData;
}

function StepIcon({ status }: { status: PlanStepStatus }) {
  if (status === "done")    return <CheckCircle2 className="flex-shrink-0" style={{ width: 12, height: 12, color: "#22c55e" }} />;
  if (status === "running") return <Loader2 className="flex-shrink-0 animate-spin" style={{ width: 12, height: 12, color: "#3b82f6" }} />;
  if (status === "error")   return <XCircle className="flex-shrink-0" style={{ width: 12, height: 12, color: "#ef4444" }} />;
  return <Circle className="flex-shrink-0" style={{ width: 8, height: 8, color: "rgba(100,116,139,0.3)", margin: "0 2px" }} />;
}

function stepLabel(status: PlanStepStatus) {
  if (status === "done")    return { color: "#22c55e",              text: "done"    };
  if (status === "running") return { color: "#3b82f6",              text: "running" };
  if (status === "error")   return { color: "#ef4444",              text: "error"   };
  return { color: "rgba(100,116,139,0.45)", text: "pending" };
}

export function PlanningCard({ plan }: PlanningCardProps) {
  const [expanded, setExpanded] = useState(true);

  const done    = plan.steps.filter((s) => s.status === "done").length;
  const running = plan.steps.filter((s) => s.status === "running").length;
  const error   = plan.steps.filter((s) => s.status === "error").length;
  const total   = plan.steps.length;
  const pct     = total > 0 ? Math.round(((done + error) / total) * 100) : 0;

  const progressColor = error > 0 ? "#ef4444" : running > 0 ? "#3b82f6" : "#22c55e";

  return (
    <div className="rounded-xl overflow-hidden" data-testid="planning-card"
      style={{ background: "#111827", border: "1px solid #1f2937" }}>

      {/* Header */}
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
        data-testid="button-planning-card-toggle">
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <Brain style={{ width: 11, height: 11, color: "#3b82f6" }} />
        </div>
        <span className="text-[11px] font-semibold flex-1" style={{ color: "#e5e7eb" }}>
          Execution Plan
        </span>
        {plan.complexity && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: "#0b0f14", border: "1px solid #1f2937", color: "#94a3b8" }}>
            {plan.complexity}
          </span>
        )}
        <span className="text-[10px] font-mono tabular-nums" style={{ color: "#94a3b8" }}>
          {done}/{total}
        </span>
        <ChevronDown style={{
          width: 12, height: 12, color: "#94a3b8",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
        }} />
      </button>

      {/* Progress bar */}
      <div className="px-3 pb-1.5">
        <div className="h-[2px] rounded-full overflow-hidden" style={{ background: "#1f2937" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: progressColor }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px]" style={{ color: "rgba(100,116,139,0.5)" }}>
            {pct}% complete
          </span>
          {running > 0 && (
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "#3b82f6" }}>
              <Loader2 className="animate-spin" style={{ width: 8, height: 8 }} />
              {running} running
            </span>
          )}
        </div>
      </div>

      {/* Steps — vertical timeline */}
      {expanded && (
        <div className="px-3 pb-2.5">
          <div className="relative pl-4 flex flex-col gap-0.5" style={{ borderLeft: "1px solid #1f2937" }}>
            {plan.steps.map((step, i) => {
              const lbl = stepLabel(step.status);
              return (
                <div key={step.id ?? i}
                  className="relative flex items-center gap-2 py-1">
                  {/* dot on timeline */}
                  <div className="absolute -left-5 top-1/2 -translate-y-1/2">
                    <StepIcon status={step.status} />
                  </div>
                  <span
                    className="flex-1 text-[11px] truncate"
                    style={{ color: step.status === "pending" ? "rgba(148,163,184,0.55)" : "#e5e7eb" }}>
                    {step.title}
                  </span>
                  <span className="text-[9px] font-mono flex-shrink-0" style={{ color: lbl.color }}>
                    {lbl.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risks */}
      {expanded && Array.isArray(plan.risks) && plan.risks.length > 0 && (
        <div className="px-3 pb-2.5 flex items-center gap-1.5" style={{ borderTop: "1px solid #1f2937" }}>
          <AlertTriangle style={{ width: 10, height: 10, color: "#f59e0b", flexShrink: 0 }} />
          <span className="text-[9.5px]" style={{ color: "rgba(245,158,11,0.75)" }}>
            {plan.risks.join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
