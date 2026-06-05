import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeployStep {
  id: string;
  label: string;
}

type StepState = "pending" | "running" | "success" | "error";

interface DeployStepsRowProps {
  steps: DeployStep[];
  stepStates: StepState[];
}

export function DeployStepsRow({ steps, stepStates }: DeployStepsRowProps) {
  return (
    <div className="flex-shrink-0 px-5 pt-4 pb-2">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const state = stepStates[i] ?? "pending";
          const isRunning = state === "running";
          const isSuccess = state === "success";
          const isError   = state === "error";

          return (
            <div key={step.id} className="flex items-center gap-1 flex-1">
              <div
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[10.5px] font-semibold transition-all duration-500 overflow-hidden",
                  isRunning && "step-running-glow"
                )}
                style={{
                  background: isSuccess
                    ? "rgba(74,222,128,0.1)"
                    : isError
                    ? "rgba(248,113,113,0.1)"
                    : isRunning
                    ? "rgba(124,141,255,0.1)"
                    : "rgba(255,255,255,0.03)",
                  border: isSuccess
                    ? "1px solid rgba(74,222,128,0.25)"
                    : isError
                    ? "1px solid rgba(248,113,113,0.25)"
                    : isRunning
                    ? "1px solid rgba(124,141,255,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
                  color: isSuccess
                    ? "#4ade80"
                    : isError
                    ? "#f87171"
                    : isRunning
                    ? "#a78bfa"
                    : "rgba(100,116,139,0.45)",
                }}
                data-testid={`deploy-step-${step.id}`}
              >
                {isSuccess && <CheckCircle2 className="h-2.5 w-2.5 flex-shrink-0 success-icon" />}
                {isError   && <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />}
                {isRunning && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#a78bfa", animation: "pulse-glow 1.2s ease-in-out infinite" }}
                  />
                )}
                <span className="truncate">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="w-2 h-px flex-shrink-0 transition-all duration-500"
                  style={{ background: stepStates[i] === "success" ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.07)" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
