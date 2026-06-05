import { useRef, useEffect } from "react";
import {
  AlertTriangle,
  Rocket,
  Loader2,
  Clock,
  X,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeployState, DEPLOY_STEPS, MOCK_DOMAIN, fmtMs } from "./types";
import { DeployStepsRow } from "./DeployStepsRow";
import { DeployLogTerminal } from "./DeployLogTerminal";
import { DeployFooterActions } from "./DeployFooterActions";

export function DeployOverlayPanel({
  deployState,
  onRetry,
  onClose,
}: {
  deployState: DeployState;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { stepStates, stepLogs, currentStep, done, failed, elapsedMs } = deployState;
  const logEndRef = useRef<HTMLDivElement>(null);
  const canClose = done;

  const totalSteps = DEPLOY_STEPS.length;
  const completedSteps = stepStates.filter((s) => s === "success").length;
  const progressPct = done
    ? failed ? ((currentStep / totalSteps) * 100) : 100
    : Math.min(((completedSteps / totalSteps) * 100) + (stepStates[currentStep] === "running" ? (100 / totalSteps) * 0.5 : 0), 99);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stepLogs]);

  const allLogs = stepLogs.flat();

  return (
    <div
      className="absolute inset-0 flex flex-col z-20"
      style={{
        background: "hsl(222,30%,5%)",
        animation: "overlay-slidein 0.3s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <style>{`
        @keyframes overlay-slidein {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1;   }
        }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,141,255,0.0); }
          50%       { box-shadow: 0 0 0 4px rgba(124,141,255,0.18); }
        }
        @keyframes shimmer-bar {
          0%   { background-position: -300% center; }
          100% { background-position:  300% center; }
        }
        @keyframes log-fadein {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes success-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .step-running-glow { animation: pulse-glow 1.6s ease-in-out infinite; }
        .shimmer-bar {
          background: linear-gradient(90deg,
            rgba(124,141,255,0.6) 0%,
            rgba(167,139,250,1)   40%,
            rgba(200,180,255,0.9) 55%,
            rgba(167,139,250,1)   70%,
            rgba(124,141,255,0.6) 100%
          );
          background-size: 300% auto;
          animation: shimmer-bar 1.8s linear infinite;
        }
        .log-line { animation: log-fadein 0.2s ease; }
        .success-icon { animation: success-pop 0.4s cubic-bezier(0.22,1,0.36,1); }
      `}</style>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2.5">
          {done ? (
            failed ? (
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#f87171" }} />
            ) : (
              <Rocket className="h-3.5 w-3.5 success-icon" style={{ color: "#4ade80" }} />
            )
          ) : (
            <Loader2
              className="h-3.5 w-3.5"
              style={{ color: "#a78bfa", animation: "spin-slow 1s linear infinite" }}
            />
          )}
          <span className="text-xs font-semibold tracking-wide" style={{ color: "rgba(226,232,240,0.85)" }}>
            {done
              ? failed
                ? "Deployment Failed"
                : "Deployment Complete"
              : "Deploying to Production"}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(148,163,184,0.55)" }}>
            <Clock className="h-2.5 w-2.5 inline-block mr-1 relative" style={{ top: "-1px" }} />
            {fmtMs(elapsedMs)}
          </span>
        </div>

        <button
          onClick={onClose}
          disabled={!canClose}
          className="p-1.5 rounded-md transition-all duration-150"
          style={{
            color: canClose ? "rgba(148,163,184,0.6)" : "rgba(100,116,139,0.3)",
            cursor: canClose ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => { if (canClose) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          title={canClose ? "Close" : "Wait for deployment to finish"}
          data-testid="button-close-deploy-panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-5 pt-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium" style={{ color: "rgba(148,163,184,0.6)" }}>
            {done
              ? failed
                ? `Failed at step ${currentStep + 1} of ${totalSteps}`
                : `All ${totalSteps} steps complete`
              : `Step ${Math.min(currentStep + 1, totalSteps)} of ${totalSteps}`}
          </span>
          <span className="text-[11px] font-semibold font-mono" style={{ color: done && !failed ? "#4ade80" : failed ? "#f87171" : "rgba(167,139,250,0.85)" }}>
            {Math.round(progressPct)}%
          </span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out", !done && "shimmer-bar")}
            style={{
              width: `${progressPct}%`,
              background: done
                ? failed
                  ? "rgba(248,113,113,0.8)"
                  : "#4ade80"
                : undefined,
            }}
          />
        </div>
      </div>

      <DeployStepsRow steps={DEPLOY_STEPS} stepStates={stepStates} />

      <DeployLogTerminal allLogs={allLogs} done={done} logEndRef={logEndRef} />

      {done && (
        <DeployFooterActions
          failed={failed}
          currentStep={currentStep}
          onRetry={onRetry}
          onClose={onClose}
          steps={DEPLOY_STEPS}
          mockDomain={MOCK_DOMAIN}
        />
      )}
    </div>
  );
}
