/**
 * CheckpointRollbackDialog — inline confirmation before calling real rollback API.
 * Replaces the timeout-based confirm approach in CheckpointCard.
 * < 80 LOC
 */
import { useState } from "react";
import { RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  checkpointId: string;
  projectId:    number;
  onSuccess:    () => void;
  onCancel:     () => void;
}

export function CheckpointRollbackDialog({ checkpointId, projectId, onSuccess, onCancel }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleRollback = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/checkpoints/${projectId}/${checkpointId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSuccess();
    } catch (e: any) {
      setErrMsg(e?.message ?? "Rollback failed");
      setStatus("error");
    }
  };

  return (
    <div className="px-3 pb-3 pt-2" style={{ borderTop: "1px solid rgba(239,68,68,0.15)", animation: "checkpoint-in 0.15s ease-out both" }}>
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
        <p className="text-[10.5px] leading-relaxed" style={{ color: "rgba(203,213,225,0.85)" }}>
          This will restore all files to their state at this checkpoint. Changes made after it will be lost.
        </p>
      </div>
      {status === "error" && (
        <p className="text-[10px] mb-2 px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
          {errMsg}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg text-[10.5px] font-medium transition-all"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(203,213,225,0.75)" }}
          data-testid={`button-rollback-cancel-${checkpointId}`}
        >
          Cancel
        </button>
        <button
          onClick={handleRollback}
          disabled={status === "loading"}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-medium transition-all")}
          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}
          data-testid={`button-rollback-confirm-${checkpointId}`}
        >
          {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          {status === "loading" ? "Rolling back…" : "Rollback here"}
        </button>
      </div>
    </div>
  );
}
