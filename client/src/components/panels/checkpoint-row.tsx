import { useState } from "react";
import {
  Camera, RotateCcw, ChevronDown, GitCommit,
  ShieldCheck, Loader2, CheckCircle2, FileCode, Clock,
  Diff, Trash2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRollbackCheckpoint,
  useDeleteCheckpoint,
  useValidateCheckpoint,
  type CheckpointMeta,
} from "@/hooks/use-checkpoints";
import { DiffViewer } from "./checkpoint-diff-viewer";
import { triggerLabel, statusColor, fmtRelative } from "./checkpoint-helpers";

export function CheckpointRow({
  cp, isLatest, compareMode, isCompareSelected, onToggleCompare, allIds,
}: {
  cp: CheckpointMeta;
  isLatest: boolean;
  compareMode: boolean;
  isCompareSelected: boolean;
  onToggleCompare: () => void;
  allIds: string[];
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [rollState,   setRollState]   = useState<"idle"|"confirm"|"rolling"|"done"|"error">("idle");
  const [deleteState, setDeleteState] = useState<"idle"|"confirm"|"deleting"|"done"|"error">("idle");
  const [validateMsg, setValidateMsg] = useState<string | null>(null);
  const [showDiff,    setShowDiff]    = useState(false);
  const [diffTarget,  setDiffTarget]  = useState("");

  const rollback = useRollbackCheckpoint();
  const deleteCp = useDeleteCheckpoint();
  const validate = useValidateCheckpoint();
  const status   = (cp as CheckpointMeta & { status?: string }).status ?? "stable";
  const sc       = statusColor(status);
  const prevId   = allIds[allIds.indexOf(cp.id) + 1];
  const fileCount = (cp.fileCount ?? cp.filesChanged) ?? 0;
  const gitSha   = cp.gitSha ?? cp.gitCommitSha;
  const label    = (cp as CheckpointMeta & { label?: string }).label ?? (cp as CheckpointMeta & { title?: string }).title;

  const handleRollback = async () => {
    if (rollState === "idle")    { setRollState("confirm"); setTimeout(() => setRollState(s => s === "confirm" ? "idle" : s), 4000); return; }
    if (rollState === "confirm") {
      setRollState("rolling");
      try {
        await rollback.mutateAsync(cp.id);
        setRollState("done");
        setTimeout(() => setRollState("idle"), 3000);
      } catch {
        setRollState("error");
        setTimeout(() => setRollState("idle"), 3000);
      }
    }
  };

  const handleDelete = async () => {
    if (deleteState === "idle")    { setDeleteState("confirm"); setTimeout(() => setDeleteState(s => s === "confirm" ? "idle" : s), 4000); return; }
    if (deleteState === "confirm") {
      setDeleteState("deleting");
      try {
        await deleteCp.mutateAsync(cp.id);
        setDeleteState("done");
      } catch {
        setDeleteState("error");
        setTimeout(() => setDeleteState("idle"), 3000);
      }
    }
  };

  const handleValidate = async () => {
    setValidateMsg(null);
    try {
      const res = await validate.mutateAsync(cp.id) as { valid: boolean; errors?: string[] };
      setValidateMsg(res.valid ? "✓ Integrity OK" : `✗ ${(res.errors ?? []).join(", ")}`);
      setTimeout(() => setValidateMsg(null), 5000);
    } catch {
      setValidateMsg("✗ Validation failed");
      setTimeout(() => setValidateMsg(null), 4000);
    }
  };

  if (deleteState === "done") return null;

  return (
    <div className="relative" style={{ animation: "cp-fadein 0.2s cubic-bezier(0.22,1,0.36,1) both" }}>
      <div
        className={cn("rounded-xl overflow-hidden transition-all duration-200", compareMode && isCompareSelected ? "ring-1" : "")}
        style={{
          background: compareMode && isCompareSelected ? "rgba(124,141,255,0.07)" : expanded ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.025)",
          border: compareMode && isCompareSelected ? "1px solid rgba(124,141,255,0.35)" : expanded ? "1px solid rgba(251,191,36,0.22)" : "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Header row */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
          onClick={() => compareMode ? onToggleCompare() : setExpanded(v => !v)}
          data-testid={`checkpoint-row-${cp.id}`}
        >
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.22)" }}>
            <Camera style={{ width: 13, height: 13, color: "#fbbf24" }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11.5px] font-semibold" style={{ color: "rgba(226,232,240,0.92)" }}>
                {triggerLabel(cp.trigger)}
                {label && label !== "manual" && label !== triggerLabel(cp.trigger) ? ` · ${label}` : ""}
              </span>
              {isLatest && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>latest</span>
              )}
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                {status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock style={{ width: 9, height: 9, color: "rgba(148,163,184,0.45)" }} />
              <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.55)" }}>{fmtRelative(cp.createdAt)}</span>
              {gitSha && (
                <>
                  <GitCommit style={{ width: 9, height: 9, color: "rgba(148,163,184,0.35)" }} />
                  <span className="text-[10px] font-mono" style={{ color: "rgba(148,163,184,0.45)" }}>{gitSha.slice(0, 7)}</span>
                </>
              )}
              {fileCount > 0 && (
                <>
                  <FileCode style={{ width: 9, height: 9, color: "rgba(148,163,184,0.35)" }} />
                  <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.45)" }}>{fileCount} files</span>
                </>
              )}
            </div>
          </div>

          {!compareMode && (
            <ChevronDown style={{ width: 13, height: 13, color: "rgba(148,163,184,0.4)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
          )}
          {compareMode && (
            <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: isCompareSelected ? "rgba(124,141,255,0.3)" : "rgba(255,255,255,0.06)", border: `1px solid ${isCompareSelected ? "rgba(124,141,255,0.5)" : "rgba(255,255,255,0.1)"}` }}>
              {isCompareSelected && <CheckCircle2 style={{ width: 10, height: 10, color: "#7c8dff" }} />}
            </div>
          )}
        </div>

        {/* Expanded body */}
        {expanded && !compareMode && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", animation: "cp-fadein 0.15s ease both" }}>
            <div className="px-3 py-3 space-y-2.5">
              {validateMsg && (
                <p className="text-[10.5px] px-2.5 py-1.5 rounded-lg" style={{ background: validateMsg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${validateMsg.startsWith("✓") ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`, color: validateMsg.startsWith("✓") ? "#4ade80" : "#f87171" }}>
                  {validateMsg}
                </p>
              )}

              {showDiff ? (
                <DiffViewer fromId={cp.id} toId={diffTarget || prevId || cp.id} onClose={() => setShowDiff(false)} />
              ) : prevId ? (
                <button
                  onClick={() => { setDiffTarget(prevId); setShowDiff(true); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10.5px] transition-all hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.07)", color: "rgba(148,163,184,0.7)" }}
                  data-testid={`button-diff-${cp.id}`}
                >
                  <Diff style={{ width: 11, height: 11 }} />
                  Compare with previous checkpoint
                </button>
              ) : null}

              <div className="flex gap-1.5">
                {/* Rollback */}
                <button
                  onClick={handleRollback}
                  disabled={rollState === "rolling" || rollState === "done" || status === "rolled_back"}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10.5px] font-medium transition-all"
                  style={
                    rollState === "done"    ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" } :
                    rollState === "error"   ? { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" } :
                    rollState === "confirm" ? { background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.45)", color: "#fbbf24" } :
                    rollState === "rolling" ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.5)" } :
                    status === "rolled_back" ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(148,163,184,0.35)", cursor: "not-allowed" } :
                    { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(252,165,165,0.85)" }
                  }
                  data-testid={`button-rollback-${cp.id}`}
                >
                  {rollState === "rolling" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw style={{ width: 11, height: 11 }} />}
                  {rollState === "idle"    && (status === "rolled_back" ? "Rolled back" : "Rollback")}
                  {rollState === "confirm" && "Confirm?"}
                  {rollState === "rolling" && "Rolling…"}
                  {rollState === "done"    && "Done!"}
                  {rollState === "error"   && "Failed"}
                </button>

                {/* Validate */}
                <button
                  onClick={handleValidate}
                  disabled={validate.isPending}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10.5px] font-medium transition-all hover:bg-white/8"
                  style={{ border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.7)" }}
                  data-testid={`button-validate-${cp.id}`}
                  title="Validate checkpoint integrity"
                >
                  {validate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck style={{ width: 11, height: 11 }} />}
                </button>

                {/* Delete */}
                <button
                  onClick={handleDelete}
                  disabled={deleteState === "deleting"}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10.5px] font-medium transition-all"
                  style={
                    deleteState === "confirm" ? { background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.45)", color: "#f87171" } :
                    deleteState === "deleting" ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.4)" } :
                    deleteState === "error"   ? { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" } :
                    { border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.5)" }
                  }
                  data-testid={`button-delete-${cp.id}`}
                  title={deleteState === "confirm" ? "Click again to confirm delete" : "Delete checkpoint"}
                >
                  {deleteState === "deleting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 style={{ width: 11, height: 11 }} />}
                  {deleteState === "confirm" && <span className="text-[9.5px]">Sure?</span>}
                </button>
              </div>

              {deleteState === "confirm" && (
                <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", color: "rgba(252,165,165,0.8)", animation: "cp-fadein 0.12s ease both" }}>
                  <AlertTriangle style={{ width: 10, height: 10, flexShrink: 0, marginTop: 1 }} />
                  <span>This permanently removes the checkpoint and its snapshot. Click the trash icon again to confirm.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
