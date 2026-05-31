/**
 * CheckpointTimelineItem — the chat-inline checkpoint row.
 * Collapsed: ✅ "Checkpoint made just now"
 * Expanded:  description, timestamp, files count, Rollback + Changes buttons.
 * < 150 LOC
 */
import { useState } from "react";
import { CheckCircle2, ChevronDown, RotateCcw, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckpointDetailsPanel } from "./CheckpointDetailsPanel";
import { CheckpointRollbackDialog } from "./CheckpointRollbackDialog";
import { CheckpointChangesPanel } from "./CheckpointChangesPanel";
import { formatRelativeTime, triggerLabel } from "./CheckpointUtils";
import type { CheckpointData } from "@/components/panels/checkpoint-types";

interface Props {
  data:              CheckpointData;
  checkpointNumber:  number;
  isLatest:          boolean;
  projectId:         number;
}

type ActivePanel = "none" | "details" | "rollback" | "changes";

export function CheckpointTimelineItem({ data, checkpointNumber, isLatest, projectId }: Props) {
  const [panel, setPanel] = useState<ActivePanel>("none");
  const [reverted, setReverted] = useState(false);

  const toggle = (p: ActivePanel) => setPanel((cur) => cur === p ? "none" : p);
  const relTime = data.createdAt ? formatRelativeTime(data.createdAt) : data.time;
  const tLabel  = data.trigger ? triggerLabel(data.trigger) : "end of loop";
  const total   = (data.createdFiles?.length ?? 0) + (data.modifiedFiles?.length ?? 0) + (data.deletedFiles?.length ?? 0) || data.filesChanged;

  return (
    <div className="relative" style={{ animation: "checkpoint-in 0.22s cubic-bezier(0.22,1,0.36,1) both" }}>
      <div className="absolute left-[11px] -top-3 w-px h-3" style={{ background: "rgba(255,255,255,0.06)" }} />

      <div
        className={cn("rounded-xl overflow-hidden transition-all duration-200", reverted && "opacity-50")}
        style={{
          background: reverted ? "rgba(255,255,255,0.02)" : "rgba(74,222,128,0.04)",
          border: reverted ? "1px solid rgba(255,255,255,0.06)" : panel !== "none" ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(74,222,128,0.18)",
        }}
      >
        {/* ── Collapsed row ── */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
          onClick={() => !reverted && toggle("details")}
          data-testid={`checkpoint-timeline-${data.checkpointId}`}
        >
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: reverted ? "rgba(255,255,255,0.05)" : "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.22)" }}>
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: reverted ? "rgba(148,163,184,0.4)" : "#4ade80" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold" style={{ color: reverted ? "rgba(148,163,184,0.5)" : "rgba(226,232,240,0.95)" }}>
                {reverted ? "Reverted" : `Checkpoint made ${relTime}`}
              </span>
              {isLatest && !reverted && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>latest</span>
              )}
            </div>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(148,163,184,0.6)" }}>
              Saved progress at {tLabel}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150"
            style={{ color: "rgba(148,163,184,0.4)", transform: panel === "details" ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>

        {/* ── Details panel ── */}
        {panel === "details" && !reverted && (
          <>
            <CheckpointDetailsPanel
              description={`Saved progress at ${tLabel}`}
              timestamp={relTime}
              createdFiles={data.createdFiles ?? []}
              modifiedFiles={data.modifiedFiles ?? []}
              deletedFiles={data.deletedFiles ?? []}
            />
            <div className="flex items-center gap-1.5 px-3 pb-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button
                onClick={(e) => { e.stopPropagation(); toggle("rollback"); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all"
                style={panel === "rollback" ? { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" } : { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "rgba(252,165,165,0.85)" }}
                data-testid={`button-rollback-${data.checkpointId}`}
              >
                <RotateCcw className="h-3 w-3" /> Rollback here
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggle("changes"); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all"
                style={panel === "changes" ? { background: "rgba(124,141,255,0.2)", border: "1px solid rgba(124,141,255,0.4)", color: "#7c8dff" } : { background: "rgba(124,141,255,0.07)", border: "1px solid rgba(124,141,255,0.18)", color: "rgba(167,185,255,0.85)" }}
                data-testid={`button-changes-${data.checkpointId}`}
              >
                <GitCompare className="h-3 w-3" /> Changes
              </button>
            </div>
          </>
        )}

        {/* ── Rollback confirmation ── */}
        {panel === "rollback" && !reverted && (
          <CheckpointRollbackDialog
            checkpointId={data.checkpointId}
            projectId={projectId}
            onSuccess={() => { setReverted(true); setPanel("none"); }}
            onCancel={() => setPanel("details")}
          />
        )}

        {/* ── Changes file list ── */}
        {panel === "changes" && !reverted && (
          <CheckpointChangesPanel
            createdFiles={data.createdFiles ?? []}
            modifiedFiles={data.modifiedFiles ?? []}
            deletedFiles={data.deletedFiles ?? []}
          />
        )}
      </div>
    </div>
  );
}
