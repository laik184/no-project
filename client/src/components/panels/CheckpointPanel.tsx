/**
 * client/src/components/panels/CheckpointPanel.tsx
 * Full Checkpoint History panel.
 * Sub-components: checkpoint-diff-viewer, checkpoint-row, checkpoint-diagnostics
 */

import { useState } from "react";
import {
  Camera, Plus, Loader2, RefreshCw, Diff, Zap, AlertTriangle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";
import {
  useCheckpoints,
  useCreateCheckpoint,
  CHECKPOINT_KEYS,
} from "@/hooks/use-checkpoints";
import { getProjectId } from "./checkpoint-helpers";
import { DiffViewer } from "./checkpoint-diff-viewer";
import { CheckpointRow } from "./checkpoint-row";
import { DiagnosticsPanel } from "./checkpoint-diagnostics";

export function CheckpointPanel() {
  const pid = getProjectId();
  const qc  = useQueryClient();

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

  const checkpoints = (data?.checkpoints ?? []).slice().reverse();
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

      {/* Header */}
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

      {/* Create checkpoint inline */}
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

      {/* Compare mode banner */}
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

      {/* Compare diff result */}
      {compareIds && (
        <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(124,141,255,0.12)" }}>
          <DiffViewer fromId={compareIds[0]} toId={compareIds[1]} onClose={() => { setCompareIds(null); setSelectedForCmp([]); }} />
        </div>
      )}

      {/* Checkpoint list */}
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

        {!isLoading && checkpoints.length > 0 && (
          <div className="pt-2">
            <DiagnosticsPanel />
          </div>
        )}
      </div>

      {/* Footer hint */}
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
