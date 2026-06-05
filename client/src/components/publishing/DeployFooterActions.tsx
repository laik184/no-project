import { XCircle, RotateCcw, Rocket, ExternalLink, ArrowLeft } from "lucide-react";

interface DeployStep {
  id: string;
  label: string;
}

interface DeployFooterActionsProps {
  failed: boolean;
  currentStep: number;
  onRetry: () => void;
  onClose: () => void;
  steps: DeployStep[];
  mockDomain: string;
}

export function DeployFooterActions({ failed, currentStep, onRetry, onClose, steps, mockDomain }: DeployFooterActionsProps) {
  return (
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
                Failed at {steps[currentStep]?.label}. Check the logs above for details.
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
              <p className="text-[11px] font-mono mt-0.5" style={{ color: "rgba(134,239,172,0.6)" }}>{mockDomain}</p>
            </div>
          </div>
          <a
            href={`https://${mockDomain}`}
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
  );
}
