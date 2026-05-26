import { useRef, useEffect } from "react";
import {
  AlertTriangle,
  Rocket,
  Loader2,
  Clock,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeployState, DEPLOY_STEPS, MOCK_DOMAIN, fmtMs } from "./types";

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

      {/* Steps */}
      <div className="flex-shrink-0 px-5 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {DEPLOY_STEPS.map((step, i) => {
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
                {i < DEPLOY_STEPS.length - 1 && (
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

      {/* Log terminal */}
      <div
        className="flex-1 mx-5 mb-4 rounded-xl overflow-hidden flex flex-col min-h-0"
        style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.35)" }}
      >
        <div
          className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
        >
          {["#f87171", "#fbbf24", "#4ade80"].map((c) => (
            <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.5 }} />
          ))}
          <span className="ml-1 text-[10.5px] font-mono" style={{ color: "rgba(100,116,139,0.55)" }}>
            deployment.log
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2.5 font-mono text-[11px] space-y-0.5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
          {allLogs.length === 0 ? (
            <p style={{ color: "rgba(100,116,139,0.4)" }}>Waiting to start…</p>
          ) : (
            allLogs.map((line, i) => (
              <p key={i} className="log-line leading-relaxed" style={{ color: line.toLowerCase().includes("fail") || line.toLowerCase().includes("error") ? "#fca5a5" : line.toLowerCase().includes("success") || line.toLowerCase().includes("complete") || line.toLowerCase().includes("passed") || line.toLowerCase().includes("ready") || line.toLowerCase().includes("live") ? "#86efac" : "rgba(148,163,184,0.75)" }}>
                <span style={{ color: "rgba(100,116,139,0.4)", marginRight: "8px" }}>›</span>
                {line}
              </p>
            ))
          )}
          {!done && allLogs.length > 0 && (
            <p className="log-line" style={{ color: "rgba(167,139,250,0.6)" }}>
              <span style={{ marginRight: "8px" }}>›</span>
              <span style={{ animation: "pulse-glow 1.2s ease-in-out infinite" }}>_</span>
            </p>
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Footer actions */}
      {done && (
        <div
          className="flex-shrink-0 px-5 pb-5 pt-1 flex items-center gap-2.5"
          style={{ animation: "log-fadein 0.3s ease" }}
        >
          {failed ? (
            <>
              <div className="flex items-start gap-2 flex-1 p-3 rounded-xl" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: "#f87171" }} />
                <div>
                  <p className="text-[12px] font-medium" style={{ color: "#fca5a5" }}>Deployment failed</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(252,165,165,0.6)" }}>
                    Failed at {DEPLOY_STEPS[currentStep]?.label}. Check the logs above for details.
                  </p>
                </div>
              </div>
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-semibold flex-shrink-0 transition-all duration-150"
                style={{ background: "linear-gradient(135deg,#7c8dff,#a78bfa)", color: "#fff" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                data-testid="button-retry-deploy"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-1 p-3 rounded-xl" style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)" }}>
                <Rocket className="h-3.5 w-3.5 flex-shrink-0 success-icon" style={{ color: "#4ade80" }} />
                <div>
                  <p className="text-[12px] font-medium" style={{ color: "#86efac" }}>Your app is live 🚀</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "rgba(134,239,172,0.6)" }}>{MOCK_DOMAIN}</p>
                </div>
              </div>
              <a
                href={`https://${MOCK_DOMAIN}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-semibold flex-shrink-0 transition-all duration-150"
                style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(74,222,128,0.22)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(74,222,128,0.15)"; }}
                data-testid="link-view-live"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View live
              </a>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-semibold flex-shrink-0 transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(203,213,225,0.8)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                data-testid="button-close-after-deploy"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
