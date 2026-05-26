import { useState } from "react";
import { Camera, RotateCcw, Check, ChevronDown, FileCode, Clock, Eye, Pencil, X, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTION_STEPS } from "./checkpoint-types";
export type { CheckpointData } from "./checkpoint-types";

interface CheckpointCardProps {
  data: import("./checkpoint-types").CheckpointData;
  checkpointNumber: number;
  isLatest: boolean;
  allReverted?: boolean;
}

export function CheckpointCard({ data, checkpointNumber, isLatest, allReverted }: CheckpointCardProps) {
  const [revertState, setRevertState] = useState<"idle" | "confirming" | "reverted">("idle");
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [changeConfirm, setChangeConfirm] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleRevertClick = () => {
    if (revertState === "confirming") {
      setRevertState("reverted");
      setPanelOpen(false);
    } else {
      setRevertState("confirming");
      setTimeout(() => setRevertState((s) => (s === "confirming" ? "idle" : s)), 3500);
    }
  };

  const handleChangeClick = () => {
    setChangeConfirm(true);
    setTimeout(() => setChangeConfirm(false), 2000);
  };

  const isReverted = revertState === "reverted" || allReverted;
  const isConfirming = revertState === "confirming";

  return (
    <div className="relative" style={{ animation: "checkpoint-in 0.22s cubic-bezier(0.22,1,0.36,1) both" }}>
      <style>{`
        @keyframes checkpoint-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes panel-slide-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes revert-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          50%       { box-shadow: 0 0 0 4px rgba(251,191,36,0.12); }
        }
        .checkpoint-revert-pulse { animation: revert-pulse 0.8s ease-in-out 2; }
      `}</style>

      <div className="absolute left-[11px] -top-3 w-px h-3" style={{ background: "rgba(255,255,255,0.06)" }} />

      <div
        className={cn("rounded-xl overflow-hidden transition-all duration-300", isReverted ? "opacity-50" : "")}
        style={{
          background: isReverted ? "rgba(255,255,255,0.02)" : panelOpen ? "rgba(251,191,36,0.07)" : "rgba(251,191,36,0.04)",
          border: isReverted ? "1px solid rgba(255,255,255,0.06)" : panelOpen ? "1px solid rgba(251,191,36,0.35)" : isConfirming ? "1px solid rgba(251,191,36,0.45)" : "1px solid rgba(251,191,36,0.18)",
        }}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none" onClick={() => !isReverted && setPanelOpen((v) => !v)} data-testid={`checkpoint-card-${data.checkpointId}`}>
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center" style={isReverted ? { background: "rgba(255,255,255,0.05)" } : { background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.25)" }}>
            {isReverted ? <Check className="h-3.5 w-3.5" style={{ color: "rgba(148,163,184,0.5)" }} /> : <Camera className="h-3.5 w-3.5" style={{ color: "#fbbf24" }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: isReverted ? "rgba(148,163,184,0.5)" : "rgba(226,232,240,0.95)" }}>{isReverted ? "Reverted" : `Checkpoint ${checkpointNumber}`}</span>
              {isLatest && !isReverted && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>latest</span>}
            </div>
            <p className="text-[10px] truncate mt-0.5" style={{ color: "rgba(148,163,184,0.65)" }}>{data.description}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] transition-all hover:bg-white/5" style={{ color: "rgba(148,163,184,0.45)" }} data-testid={`button-expand-checkpoint-${data.checkpointId}`}>
              <ChevronDown className="h-3 w-3 transition-transform duration-150" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {!isReverted && (
              <div className="w-4 h-4 flex items-center justify-center rounded" style={{ color: panelOpen ? "#fbbf24" : "rgba(148,163,184,0.4)" }}>
                <ChevronDown className="h-3 w-3 transition-transform duration-200" style={{ transform: panelOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="px-3 pb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", animation: "checkpoint-in 0.15s ease-out both" }}>
            <div className="pt-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <FileCode className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(124,141,255,0.7)" }} />
                <span className="text-[10.5px]" style={{ color: "rgba(148,163,184,0.7)" }}><span style={{ color: "rgba(203,213,225,0.9)", fontWeight: 500 }}>{data.filesChanged} file{data.filesChanged !== 1 ? "s" : ""}</span> changed</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(124,141,255,0.7)" }} />
                <span className="text-[10.5px]" style={{ color: "rgba(148,163,184,0.7)" }}>Saved <span style={{ color: "rgba(203,213,225,0.9)", fontWeight: 500 }}>{data.time}</span></span>
              </div>
              <div className="mt-1 px-2.5 py-1.5 rounded-lg text-[10.5px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(203,213,225,0.8)" }}>{data.label}</div>
            </div>
          </div>
        )}

        {panelOpen && !isReverted && (
          <div style={{ borderTop: "1px solid rgba(251,191,36,0.15)", animation: "panel-slide-in 0.18s cubic-bezier(0.22,1,0.36,1) both" }}>
            <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-3 w-3" style={{ color: "#fbbf24" }} />
                <span className="text-[10.5px] font-semibold" style={{ color: "rgba(226,232,240,0.9)" }}>Action Steps</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setPanelOpen(false); }} className="w-4 h-4 flex items-center justify-center rounded transition-all hover:bg-white/10" style={{ color: "rgba(148,163,184,0.5)" }} data-testid={`button-close-panel-${data.checkpointId}`}>
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="px-3 pb-2">
              <p className="text-[10px] leading-relaxed" style={{ color: "rgba(148,163,184,0.75)" }}>Add detailed action steps to the chat interface for better feedback</p>
            </div>
            <div className="px-3 pb-2.5 space-y-1">
              {ACTION_STEPS.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <span className="text-[11px]">{step.icon}</span>
                  <span className="text-[10px]" style={{ color: "rgba(203,213,225,0.75)" }}>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 px-3 pb-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} onClick={(e) => e.stopPropagation()}>
              <button onClick={handleRevertClick} className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all", isConfirming ? "checkpoint-revert-pulse" : "")} style={isConfirming ? { background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.5)", color: "#fbbf24" } : { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(252,165,165,0.85)" }} data-testid={`button-rollback-${data.checkpointId}`}>
                <RotateCcw className="h-3 w-3" />
                {isConfirming ? "Confirm?" : "Rollback"}
              </button>
              <button onClick={() => setPreviewOpen((v) => !v)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all" style={previewOpen ? { background: "rgba(124,141,255,0.2)", border: "1px solid rgba(124,141,255,0.4)", color: "#7c8dff" } : { background: "rgba(124,141,255,0.07)", border: "1px solid rgba(124,141,255,0.18)", color: "rgba(167,185,255,0.85)" }} data-testid={`button-view-preview-${data.checkpointId}`}>
                <Eye className="h-3 w-3" />
                View Preview
              </button>
              <button onClick={handleChangeClick} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all" style={changeConfirm ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80" } : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.75)" }} data-testid={`button-change-${data.checkpointId}`}>
                <Pencil className="h-3 w-3" />
                {changeConfirm ? "Ready!" : "Change"}
              </button>
            </div>
            {previewOpen && (
              <div className="mx-3 mb-3 px-2.5 py-2 rounded-lg text-[10px] leading-relaxed" style={{ background: "rgba(124,141,255,0.06)", border: "1px solid rgba(124,141,255,0.15)", color: "rgba(167,185,255,0.8)", animation: "panel-slide-in 0.15s ease-out both" }}>
                📸 Preview from <span style={{ fontWeight: 600 }}>Checkpoint {checkpointNumber}</span> — {data.time}
                <br />
                <span style={{ color: "rgba(148,163,184,0.55)" }}>Open the Preview tab to see the state of your app at this checkpoint.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
