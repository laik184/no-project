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
  snapshotPath?: string;
  fileCount?: number;
  createdAt: string;
  runId?: string;
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

const KEYS = {
  list:        (pid: number) => ["/api/checkpoints", pid],
  single:      (pid: number, id: string) => ["/api/checkpoints", pid, id],
  diagnostics: (pid: number) => ["/api/checkpoints", pid, "diagnostics"],
  diff:        (pid: number, a: string, b: string) => ["/api/checkpoints", pid, "diff", a, b],
};

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

export function useCheckpoints(refetchInterval = 8000) {
  const pid = getProjectId();
  return useQuery<{ ok: boolean; checkpoints: CheckpointMeta[] }>({
    queryKey: KEYS.list(pid),
    queryFn:  () => apiFetch(`/api/checkpoints/${pid}`),
    refetchInterval,
  });
}

export function useCheckpointDiff(checkpointId: string, compareId: string, enabled: boolean) {
  const pid = getProjectId();
  return useQuery<{ ok: boolean; diff: SnapshotDiff; summary: string }>({
    queryKey: KEYS.diff(pid, checkpointId, compareId),
    queryFn:  () => apiFetch(`/api/checkpoints/${pid}/${checkpointId}/diff?compareId=${compareId}`),
    enabled,
  });
}

export function useRecoveryDiagnostics() {
  const pid = getProjectId();
  return useQuery<{ ok: boolean; diagnostics: RecoveryDiagnostics }>({
    queryKey: KEYS.diagnostics(pid),
    queryFn:  () => apiFetch(`/api/checkpoints/${pid}/recovery/diagnostics`),
    refetchInterval: 10000,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list(pid) }),
  });
}

export function useRollbackCheckpoint() {
  const qc  = useQueryClient();
  const pid = getProjectId();
  return useMutation({
    mutationFn: (checkpointId: string) =>
      apiFetch(`/api/checkpoints/${pid}/${checkpointId}/rollback`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list(pid) });
      qc.invalidateQueries({ queryKey: KEYS.diagnostics(pid) });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.diagnostics(pid) }),
  });
}
