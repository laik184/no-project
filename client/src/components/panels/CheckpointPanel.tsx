/**
 * client/src/components/panels/CheckpointPanel.tsx
 *
 * Full Checkpoint History panel.
 * Tasks implemented here:
 *   T3 — SSE-driven cache invalidation (no more 8 s polling lag)
 *   T4 — Delete checkpoint button + confirmation dialog
 *   T6 — Enhanced diff viewer (created / modified / deleted sections)
 */

import { useState } from "react";
import {
  Camera, RotateCcw, Plus, ChevronDown, GitCommit,
  ShieldCheck, Loader2, RefreshCw,
  Activity, X, CheckCircle2, FileCode, Clock,
  Diff, Zap, Trash2, AlertTriangle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";
import {
  useCheckpoints,
  useCheckpointDiff,
  useRecoveryDiagnostics,
  useCreateCheckpoint,
  useRollbackCheckpoint,
  useDeleteCheckpoint,
  useValidateCheckpoint,
  useResetRecovery,
  CHECKPOINT_KEYS,
  type CheckpointMeta,
  type CheckpointStatus,
  type CheckpointTrigger,
} from "@/hooks/use-checkpoints";

// ── Helpers ────────────────────────────────────────────────────────────────

function getProjectId(): number {
  return Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function triggerLabel(t: CheckpointTrigger | string): string {
  const map: Record<string, string> = {
    run_start: "Before run", run_complete: "After run",
    manual: "Manual", pre_destructive: "Pre-delete",
    auto: "Auto", emergency: "Emergency",
    loop_end: "Loop end", phase_complete: "Phase",
    files_threshold: "File threshold",
  };
  return map[t] ?? t;
}

function statusColor(s: CheckpointStatus | string) {
  if (s === "stable")      return { text: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.28)"  };
  if (s === "rolled_back") return { text: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.28)"  };
  if (s === "failed")      return { text: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.28)" };
  return                          { text: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.28)"  };
}

// ── Enhanced Diff Viewer (Task 6) ─────────────────────────────────────────

function DiffViewer({ fromId, toId, onClose }: { fromId: string; toId: string; onClose: () => void }) {
  const pid = getProjectId();
  const { data, isLoading, isError } = useCheckpointDiff(fromId, toId, !!(fromId && toId && fromId !== toId));
  const diff = data?.diff;

  const renderSection = (files: string[], color: string, symbol: string, label: string) => {
    if (!files.length) return null;
    return (
      <div>
        <p className="font-semibold mb-1 flex items-center gap-1" style={{ color }}>
          <span>{symbol}</span>
          <span>{label}</span>
          <span className="font-normal text-[9.5px] ml-0.5" style={{ color: `${color}99` }}>({files.length})</span>
        </p>
        <div className="space-y-0.5 max-h-36 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {files.map(f => (
            <p key={f} className="truncate pl-2 flex items-center gap-1" style={{ color: `${color}bb` }}>
              <FileCode style={{ width: 8, height: 8, flexShrink: 0 }} />
              <span className="truncate text-[9.5px]">{f}</span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(124,141,255,0.22)", background: "rgba(124,141,255,0.04)", animation: "cp-fadein 0.18s ease both" }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(124,141,255,0.14)" }}>
        <div className="flex items-center gap-1.5">
          <Diff style={{ width: 11, height: 11, color: "#7c8dff" }} />
          <span className="text-[10.5px] font-semibold" style={{ color: "rgba(203,213,225,0.9)" }}>Snapshot diff</span>
          {data?.summary && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(124,141,255,0.12)", color: "rgba(167,185,255,0.8)" }}>
              {data.summary}
            </span>
          )}
        </div>
        <button onClick={onClose} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10" style={{ color: "rgba(148,163,184,0.5)" }}>
          <X style={{ width: 10, height: 10 }} />
        </button>
      </div>

      <div className="px-3 py-2.5 text-[10px]">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#7c8dff" }} />
          </div>
        )}
        {isError && (
          <p className="py-2 text-center" style={{ color: "rgba(248,113,113,0.7)" }}>Could not load diff.</p>
        )}
        {diff && !isLoading && (
          <div className="space-y-3">
            {renderSection(diff.added,    "#4ade80", "+", "Added")}
            {renderSection(diff.modified, "#fbbf24", "~", "Modified")}
            {renderSection(diff.removed,  "#f87171", "−", "Removed")}
            {diff.totalChanges === 0 && (
              <p className="py-2 text-center" style={{ color: "rgba(148,163,184,0.5)" }}>No file changes between these checkpoints.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single checkpoint row ─────────────────────────────────────────────────

function CheckpointRow({
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
        {/* ── Header row ── */}
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

        {/* ── Expanded body ── */}
        {expanded && !compareMode && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", animation: "cp-fadein 0.15s ease both" }}>
            <div className="px-3 py-3 space-y-2.5">
              {validateMsg && (
                <p className="text-[10.5px] px-2.5 py-1.5 rounded-lg" style={{ background: validateMsg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${validateMsg.startsWith("✓") ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`, color: validateMsg.startsWith("✓") ? "#4ade80" : "#f87171" }}>
                  {validateMsg}
                </p>
              )}

              {/* Diff section */}
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

              {/* Action row: Rollback + Validate + Delete */}
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

                {/* Delete (Task 4) */}
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

              {/* Delete confirmation warning */}
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

// ── Diagnostics mini-panel ─────────────────────────────────────────────────

function DiagnosticsPanel() {
  const { data, isLoading } = useRecoveryDiagnostics();
  const reset = useResetRecovery();
  const d = data?.diagnostics;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-1.5">
          <Activity style={{ width: 11, height: 11, color: "#7c8dff" }} />
          <span className="text-[10.5px] font-semibold" style={{ color: "rgba(203,213,225,0.8)" }}>Recovery Status</span>
        </div>
        {d?.circuitOpen && (
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9.5px] font-medium transition-all hover:bg-white/8"
            style={{ border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}
            data-testid="button-reset-recovery"
          >
            <RefreshCw style={{ width: 9, height: 9 }} />
            Reset circuit
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "rgba(148,163,184,0.4)" }} />
        </div>
      ) : d ? (
        <div className="px-3 py-2.5 grid grid-cols-3 gap-2">
          {[
            { label: "Lock",    value: d.locked               ? "Locked" : "Free",   color: d.locked               ? "#fbbf24" : "#4ade80" },
            { label: "Fails",   value: String(d.consecutiveFailures),                  color: d.consecutiveFailures > 0 ? "#f87171" : "#4ade80" },
            { label: "Circuit", value: d.circuitOpen          ? "Open"   : "Closed", color: d.circuitOpen          ? "#f87171" : "#4ade80" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(148,163,184,0.4)" }}>{label}</p>
              <span className="text-[11px] font-semibold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-3 text-[10px] text-center" style={{ color: "rgba(148,163,184,0.4)" }}>Unavailable</p>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function CheckpointPanel() {
  const pid = getProjectId();
  const qc  = useQueryClient();

  // Task 3 — SSE-driven cache invalidation: any checkpoint event refreshes the list
  useRealtimeEvent("checkpoint", () => {
    qc.invalidateQueries({ queryKey: CHECKPOINT_KEYS.list(pid) });
  });

  const { data, isLoading, isFetching, refetch } = useCheckpoints();
  const createCp = useCreateCheckpoint();

  const [compareMode,    setCompareMode]    = useState(false);
  const [compareIds,     setCompareIds]     = useState<[string, string] | null>(null);
  const [selectedForCmp, setSelectedForCmp] = useState<string[]>([]);
  const [labelInput,     setLabelInput]     = useState("");
  const [showCreate,     setShowCreate]     = useState(false);

  const checkpoints = (data?.checkpoints ?? []).slice().reverse(); // newest first
  const sortedIds   = checkpoints.map(c => c.id);

  const handleToggleCompare = (id: string) => {
    setSelectedForCmp(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2)  return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleCreate = async () => {
    const label = labelInput.trim() || "manual";
    await createCp.mutateAsync(label);
    setLabelInput("");
    setShowCreate(false);
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: "rgba(8,10,20,0.7)", animation: "cp-fadein 0.2s ease" }}>
      <style>{`
        @keyframes cp-fadein {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <Camera style={{ width: 13, height: 13, color: "#fbbf24" }} />
          <span className="text-xs font-semibold" style={{ color: "rgba(226,232,240,0.85)" }}>Checkpoint History</span>
          {checkpoints.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24" }}>
              {checkpoints.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refetch()}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-all hover:bg-white/8"
            style={{ color: isFetching ? "#fbbf24" : "rgba(148,163,184,0.5)" }}
            data-testid="button-refresh-checkpoints"
            title="Refresh"
          >
            <RefreshCw style={{ width: 11, height: 11 }} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setCompareMode(v => !v); setSelectedForCmp([]); setCompareIds(null); }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
            style={compareMode ? { background: "rgba(124,141,255,0.15)", border: "1px solid rgba(124,141,255,0.35)", color: "#7c8dff" } : { border: "1px solid rgba(255,255,255,0.09)", color: "rgba(148,163,184,0.65)" }}
            data-testid="button-compare-mode"
          >
            <Diff style={{ width: 10, height: 10 }} />
            Compare
          </button>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
            style={{ background: showCreate ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.75)" }}
            data-testid="button-show-create-checkpoint"
          >
            <Plus style={{ width: 10, height: 10 }} />
            Save
          </button>
        </div>
      </div>

      {/* ── Create checkpoint inline ── */}
      {showCreate && (
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(74,222,128,0.03)", animation: "cp-fadein 0.15s ease both" }}>
          <input
            value={labelInput}
            onChange={e => setLabelInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="Label (optional)…"
            autoFocus
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[11.5px] outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(226,232,240,0.9)" }}
            data-testid="input-checkpoint-label"
          />
          <button
            onClick={handleCreate}
            disabled={createCp.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-medium transition-all"
            style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.28)", color: "#4ade80" }}
            data-testid="button-create-checkpoint"
          >
            {createCp.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera style={{ width: 11, height: 11 }} />}
            {createCp.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* ── Compare mode banner ── */}
      {compareMode && (
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ background: "rgba(124,141,255,0.06)", borderBottom: "1px solid rgba(124,141,255,0.14)" }}>
          <span className="text-[10.5px]" style={{ color: "rgba(167,185,255,0.85)" }}>
            {selectedForCmp.length === 0 && "Select two checkpoints to compare"}
            {selectedForCmp.length === 1 && "Select one more checkpoint"}
            {selectedForCmp.length === 2 && "Ready to compare"}
          </span>
          {selectedForCmp.length === 2 && (
            <button
              onClick={() => setCompareIds([selectedForCmp[0], selectedForCmp[1]])}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
              style={{ background: "rgba(124,141,255,0.2)", border: "1px solid rgba(124,141,255,0.4)", color: "#7c8dff" }}
              data-testid="button-run-compare"
            >
              <Zap style={{ width: 10, height: 10 }} />
              View diff
            </button>
          )}
        </div>
      )}

      {/* ── Compare diff result ── */}
      {compareIds && (
        <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(124,141,255,0.12)" }}>
          <DiffViewer fromId={compareIds[0]} toId={compareIds[1]} onClose={() => { setCompareIds(null); setSelectedForCmp([]); }} />
        </div>
      )}

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ scrollbarWidth: "thin" }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(251,191,36,0.4)" }} />
            <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.5)" }}>Loading checkpoints…</p>
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <Camera style={{ width: 22, height: 22, color: "rgba(251,191,36,0.5)" }} />
            </div>
            <div className="text-center">
              <p className="text-[12.5px] font-semibold mb-1" style={{ color: "rgba(203,213,225,0.7)" }}>No checkpoints yet</p>
              <p className="text-[10.5px] leading-relaxed" style={{ color: "rgba(148,163,184,0.45)" }}>
                Checkpoints are auto-created at end of each agent run.<br />Click Save to create one manually.
              </p>
            </div>
          </div>
        ) : (
          checkpoints.map((cp, i) => (
            <CheckpointRow
              key={cp.id}
              cp={cp}
              isLatest={i === 0}
              compareMode={compareMode}
              isCompareSelected={selectedForCmp.includes(cp.id)}
              onToggleCompare={() => handleToggleCompare(cp.id)}
              allIds={sortedIds}
            />
          ))
        )}

        {/* ── Recovery diagnostics ── */}
        {!isLoading && checkpoints.length > 0 && (
          <div className="pt-2">
            <DiagnosticsPanel />
          </div>
        )}
      </div>

      {/* ── Footer hint ── */}
      {!compareMode && checkpoints.length > 0 && (
        <div className="px-4 py-2 flex-shrink-0 flex items-center gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <AlertTriangle style={{ width: 9, height: 9, color: "rgba(251,191,36,0.5)" }} />
          <span className="text-[9.5px]" style={{ color: "rgba(148,163,184,0.38)" }}>
            Rollback restores all files. Always validate before rolling back.
          </span>
        </div>
      )}
    </div>
  );
}
