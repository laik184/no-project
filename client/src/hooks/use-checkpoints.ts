/**
 * client/src/hooks/use-checkpoints.ts
 * TanStack Query hooks for the checkpoint / recovery API.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function getProjectId(): number {
  return Number(window.localStorage.getItem("nura.projectId") || "1") || 1;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type CheckpointStatus = "stable" | "failed" | "creating" | "rolled_back";
export type CheckpointTrigger = "run_start" | "manual" | "pre_destructive" | "auto" | "emergency";

export interface CheckpointMeta {
  id: string;
  projectId: number;
  trigger: CheckpointTrigger;
  status: CheckpointStatus;
  label: string;
  gitSha?: string;
  gitCommitSha?: string;
  snapshotPath?: string;
  fileCount?: number;
  filesChanged?: number;
  createdAt: string;
  runId?: string;
  createdFiles?: string[];
  modifiedFiles?: string[];
  deletedFiles?: string[];
}

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  modified: string[];
  totalChanges: number;
}

export interface RecoveryDiagnostics {
  locked: boolean;
  consecutiveFailures: number;
  circuitOpen: boolean;
  lastAttemptAt?: number;
  lastSuccessAt?: number;
}

// ── Query keys ─────────────────────────────────────────────────────────────

export const CHECKPOINT_KEYS = {
  list:        (pid: number) => ["/api/checkpoints", pid],
  single:      (pid: number, id: string) => ["/api/checkpoints", pid, id],
  diagnostics: (pid: number) => ["/api/checkpoints", pid, "diagnostics"],
  diff:        (pid: number, a: string, b: string) => ["/api/checkpoints", pid, "diff", a, b],
} as const;

// ── Fetchers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body as T;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch checkpoint list for the current project.
 * SSE events will trigger cache invalidation; polling is a safety net only.
 */
export function useCheckpoints(refetchInterval = 30_000) {
  const pid = getProjectId();
  return useQuery<{ ok: boolean; checkpoints: CheckpointMeta[] }>({
    queryKey: CHECKPOINT_KEYS.list(pid),
    queryFn:  () => apiFetch(`/api/checkpoints/${pid}`),
    refetchInterval,
  });
}

export function useCheckpointDiff(checkpointId: string, compareId: string, enabled: boolean) {
  const pid = getProjectId();
  return useQuery<{ ok: boolean; diff: SnapshotDiff; summary: string }>({
    queryKey: CHECKPOINT_KEYS.diff(pid, checkpointId, compareId),
    queryFn:  () => apiFetch(`/api/checkpoints/${pid}/${checkpointId}/diff?compareId=${compareId}`),
    enabled:  enabled && !!checkpointId && !!compareId,
    staleTime: 60_000,
  });
}

export function useRecoveryDiagnostics() {
  const pid = getProjectId();
  return useQuery<{ ok: boolean; diagnostics: RecoveryDiagnostics }>({
    queryKey: CHECKPOINT_KEYS.diagnostics(pid),
    queryFn:  () => apiFetch(`/api/checkpoints/${pid}/recovery/diagnostics`),
    refetchInterval: 30_000,
  });
}

export function useCreateCheckpoint() {
  const qc  = useQueryClient();
  const pid = getProjectId();
  return useMutation({
    mutationFn: (label: string) =>
      apiFetch(`/api/checkpoints/${pid}`, {
        method: "POST",
        body:   JSON.stringify({ label }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHECKPOINT_KEYS.list(pid) }),
  });
}

export function useRollbackCheckpoint() {
  const qc  = useQueryClient();
  const pid = getProjectId();
  return useMutation({
    mutationFn: (checkpointId: string) =>
      apiFetch(`/api/checkpoints/${pid}/${checkpointId}/rollback`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHECKPOINT_KEYS.list(pid) });
      qc.invalidateQueries({ queryKey: CHECKPOINT_KEYS.diagnostics(pid) });
    },
  });
}

export function useDeleteCheckpoint() {
  const qc  = useQueryClient();
  const pid = getProjectId();
  return useMutation({
    mutationFn: (checkpointId: string) =>
      apiFetch(`/api/checkpoints/${pid}/${checkpointId}`, { method: "DELETE" }),
    onMutate: async (checkpointId: string) => {
      // Optimistic update: remove from cache immediately
      await qc.cancelQueries({ queryKey: CHECKPOINT_KEYS.list(pid) });
      const prev = qc.getQueryData<{ ok: boolean; checkpoints: CheckpointMeta[] }>(
        CHECKPOINT_KEYS.list(pid),
      );
      qc.setQueryData(CHECKPOINT_KEYS.list(pid), (old: { ok: boolean; checkpoints: CheckpointMeta[] } | undefined) => {
        if (!old) return old;
        return { ...old, checkpoints: old.checkpoints.filter((c) => c.id !== checkpointId) };
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      // Roll back optimistic update on error
      if (ctx?.prev) qc.setQueryData(CHECKPOINT_KEYS.list(pid), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CHECKPOINT_KEYS.list(pid) });
    },
  });
}

export function useValidateCheckpoint() {
  const pid = getProjectId();
  return useMutation({
    mutationFn: (checkpointId: string) =>
      apiFetch(`/api/checkpoints/${pid}/${checkpointId}/validate`, { method: "POST" }),
  });
}

export function useResetRecovery() {
  const qc  = useQueryClient();
  const pid = getProjectId();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/api/checkpoints/${pid}/recovery/reset`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHECKPOINT_KEYS.diagnostics(pid) }),
  });
}
