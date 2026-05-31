import { useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle, ChevronDown, ListChecks, AlertTriangle } from "lucide-react";
import type { PlanData, PlanStepStatus } from "../types";

interface PlanningCardProps {
  plan: PlanData;
}

function StepIcon({ status }: { status: PlanStepStatus }) {
  if (status === "done")    return <CheckCircle2 className="flex-shrink-0" style={{ width: 13, height: 13, color: "#4ade80" }} />;
  if (status === "running") return <Loader2 className="flex-shrink-0 animate-spin" style={{ width: 13, height: 13, color: "#7c8dff" }} />;
  if (status === "error")   return <XCircle className="flex-shrink-0" style={{ width: 13, height: 13, color: "#f87171" }} />;
  return <Circle className="flex-shrink-0" style={{ width: 13, height: 13, color: "rgba(100,116,139,0.35)" }} />;
}

function stepLabel(status: PlanStepStatus) {
  if (status === "done")    return { color: "rgba(74,222,128,0.9)",  text: "done" };
  if (status === "running") return { color: "#7c8dff",               text: "running" };
  if (status === "error")   return { color: "#f87171",               text: "error" };
  return { color: "rgba(100,116,139,0.45)", text: "pending" };
}

export function PlanningCard({ plan }: PlanningCardProps) {
  const [expanded, setExpanded] = useState(true);

  const done    = plan.steps.filter((s) => s.status === "done").length;
  const running = plan.steps.filter((s) => s.status === "running").length;
  const error   = plan.steps.filter((s) => s.status === "error").length;
  const total   = plan.steps.length;
  const pct     = total > 0 ? Math.round(((done + error) / total) * 100) : 0;

  return (
    <div className="rounded-xl overflow-hidden" data-testid="planning-card"
      style={{ background: "rgba(124,141,255,0.05)", border: "1px solid rgba(124,141,255,0.18)" }}>

      {/* Header */}
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
        data-testid="button-planning-card-toggle">
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(124,141,255,0.15)", border: "1px solid rgba(124,141,255,0.25)" }}>
          <ListChecks style={{ width: 11, height: 11, color: "#7c8dff" }} />
        </div>
        <span className="text-[11px] font-semibold flex-1" style={{ color: "rgba(203,213,225,0.9)" }}>
          Execution Plan
        </span>
        {plan.complexity && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: "rgba(124,141,255,0.12)", border: "1px solid rgba(124,141,255,0.2)", color: "rgba(124,141,255,0.8)" }}>
            {plan.complexity}
          </span>
        )}
        <span className="text-[10px]" style={{ color: "rgba(100,116,139,0.55)" }}>
          {done}/{total}
        </span>
        <ChevronDown style={{ width: 12, height: 12, color: "rgba(100,116,139,0.5)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>

      {/* Progress bar */}
      <div className="px-3 pb-1">
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: error > 0 ? "#f87171" : running > 0 ? "#7c8dff" : "#4ade80" }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px]" style={{ color: "rgba(100,116,139,0.5)" }}>
            {pct}% complete
          </span>
          {running > 0 && (
            <span className="text-[9px]" style={{ color: "#7c8dff" }}>{running} running</span>
          )}
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="px-3 pb-2.5 flex flex-col gap-1">
          {plan.steps.map((step, i) => {
            const lbl = stepLabel(step.status);
            return (
              <div key={step.id ?? i} className="flex items-center gap-2 py-0.5">
                <StepIcon status={step.status} />
                <span className="flex-1 text-[11px] truncate"
                  style={{ color: step.status === "pending" ? "rgba(100,116,139,0.5)" : "rgba(203,213,225,0.85)" }}>
                  {step.title}
                </span>
                <span className="text-[9px] font-mono" style={{ color: lbl.color }}>{lbl.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Risks */}
      {expanded && Array.isArray(plan.risks) && plan.risks.length > 0 && (
        <div className="px-3 pb-2.5 flex items-center gap-1.5">
          <AlertTriangle style={{ width: 10, height: 10, color: "#fbbf24", flexShrink: 0 }} />
          <span className="text-[9.5px]" style={{ color: "rgba(251,191,36,0.7)" }}>
            {plan.risks.join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
