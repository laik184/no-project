import type { CheckpointStatus, CheckpointTrigger } from "@/hooks/use-checkpoints";

export function getProjectId(): number {
  return Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
}

export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function triggerLabel(t: CheckpointTrigger | string): string {
  const map: Record<string, string> = {
    run_start: "Before run", run_complete: "After run",
    manual: "Manual", pre_destructive: "Pre-delete",
    auto: "Auto", emergency: "Emergency",
    loop_end: "Loop end", phase_complete: "Phase",
    files_threshold: "File threshold",
  };
  return map[t] ?? t;
}

export function statusColor(s: CheckpointStatus | string) {
  if (s === "stable")      return { text: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.28)"  };
  if (s === "rolled_back") return { text: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.28)"  };
  if (s === "failed")      return { text: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.28)" };
  return                          { text: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.28)"  };
}
