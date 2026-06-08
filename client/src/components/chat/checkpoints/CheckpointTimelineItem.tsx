/**
 * CheckpointTimelineItem — Replit-style checkpoint row.
 * Collapsed: ✅ "Checkpoint made 2 min ago"
 * Expanded: description, timestamp, files, Rollback + Changes buttons.
 */
import { useState } from "react";
import { CheckCircle2, ChevronDown, RotateCcw, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckpointDetailsPanel }  from "./CheckpointDetailsPanel";
import { CheckpointRollbackDialog } from "./CheckpointRollbackDialog";
import { CheckpointChangesPanel }  from "./CheckpointChangesPanel";
import { formatRelativeTime, triggerLabel } from "./CheckpointUtils";
import type { CheckpointData } from "@/components/panels/checkpoint-types";

interface Props {
  data:             CheckpointData;
  checkpointNumber: number;
  isLatest:         boolean;
  projectId:        number;
}

type ActivePanel = "none" | "details" | "rollback" | "changes";

export function CheckpointTimelineItem({ data, checkpointNumber, isLatest, projectId }: Props) {
  const [panel,    setPanel]    = useState<ActivePanel>("none");
  const [reverted, setReverted] = useState(false);

  const toggle  = (p: ActivePanel) => setPanel((cur) => cur === p ? "none" : p);
  const relTime = data.createdAt ? formatRelativeTime(data.createdAt) : data.time;
  const tLabel  = data.trigger ? triggerLabel(data.trigger) : "end of loop";
  const isRollback = panel === "rollback";
  const isChanges  = panel === "changes";

  return (
    <div className="relative" style={{ animation: "checkpoint-in 0.22s cubic-bezier(0.22,1,0.36,1) both" }}>
      <div className="absolute left-[11px] -top-3 w-px h-3" style={{ background: "#1f2937" }} />

      <div
        className={cn("rounded-xl overflow-hidden transition-all duration-200", reverted && "opacity-50")}
        style={{
          background: reverted ? "rgba(255,255,255,0.02)" : "#111827",
          border: reverted
            ? "1px solid #1f2937"
            : panel !== "none"
              ? "1px solid rgba(34,197,94,0.3)"
              : "1px solid #1f2937",
        }}>

        {/* Collapsed row */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
          onClick={() => !reverted && toggle("details")}
          data-testid={`checkpoint-timeline-${data.checkpointId}`}>
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{
              background: reverted ? "rgba(255,255,255,0.04)" : "rgba(34,197,94,0.1)",
              border: "1px solid #1f2937",
            }}>
            <CheckCircle2 className="h-3.5 w-3.5"
              style={{ color: reverted ? "rgba(148,163,184,0.35)" : "#22c55e" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold"
                style={{ color: reverted ? "rgba(148,163,184,0.45)" : "rgba(226,232,240,0.95)" }}>
                {reverted ? "Reverted" : `Checkpoint made ${relTime}`}
              </span>
              {isLatest && !reverted && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)", color: "#22c55e" }}>
                  latest
                </span>
              )}
            </div>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(148,163,184,0.5)" }}>
              Saved progress at {tLabel}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150"
            style={{ color: "rgba(148,163,184,0.35)", transform: panel === "details" ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>

        {/* Details panel */}
        {panel === "details" && !reverted && (
          <>
            <CheckpointDetailsPanel
              description={`Saved progress at ${tLabel}`}
              timestamp={relTime}
              createdFiles={data.createdFiles ?? []}
              modifiedFiles={data.modifiedFiles ?? []}
              deletedFiles={data.deletedFiles ?? []}
            />
            <div className="flex items-center gap-1.5 px-3 pb-3 pt-1"
              style={{ borderTop: "1px solid #1f2937" }}>
              <button
                onClick={(e) => { e.stopPropagation(); toggle("rollback"); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all"
                style={isRollback
                  ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }
                  : { background: "rgba(239,68,68,0.06)", border: "1px solid #1f2937", color: "rgba(252,165,165,0.75)" }}
                data-testid={`button-rollback-${data.checkpointId}`}>
                <RotateCcw className="h-3 w-3" /> Rollback here
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggle("changes"); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all"
                style={isChanges
                  ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#3b82f6" }
                  : { background: "rgba(59,130,246,0.06)", border: "1px solid #1f2937", color: "rgba(147,197,253,0.75)" }}
                data-testid={`button-changes-${data.checkpointId}`}>
                <GitCompare className="h-3 w-3" /> Changes
              </button>
            </div>
          </>
        )}

        {/* Rollback */}
        {panel === "rollback" && !reverted && (
          <CheckpointRollbackDialog
            checkpointId={data.checkpointId}
            projectId={projectId}
            onSuccess={() => { setReverted(true); setPanel("none"); }}
            onCancel={() => setPanel("details")}
          />
        )}

        {/* Changes */}
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
