import type { RunHandle } from "./types.ts";

export const runs = new Map<string, RunHandle>();
export const cancellations = new Set<string>();

export function newRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getRun(runId: string): RunHandle | undefined {
  return runs.get(runId);
}

export function registerRun(handle: RunHandle): void {
  runs.set(handle.runId, handle);
}

export function requestCancel(runId: string): boolean {
  if (!runs.has(runId)) return false;
  cancellations.add(runId);
  return true;
}

export function isCancelled(runId: string): boolean {
  return cancellations.has(runId);
}

export function clearCancel(runId: string): void {
  cancellations.delete(runId);
}

/** Remove a completed/failed/cancelled run handle. Called by run-cleanup-manager. */
export function unregisterRun(runId: string): void {
  runs.delete(runId);
  cancellations.delete(runId);
}
