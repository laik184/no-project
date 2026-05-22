/**
 * path-registry.ts
 *
 * In-memory registry for all execution paths scoped to a quantum run.
 * Thread-safe for single-process Node.js event loop.
 */

import type { ExecutionPath, PathLifecycleState } from "../types/path.types.ts";

// ── Store ─────────────────────────────────────────────────────────────────────
// quantumRunId → Map<pathId, ExecutionPath>

const _runs = new Map<string, Map<string, ExecutionPath>>();

// ── Writers ───────────────────────────────────────────────────────────────────

export function registerPath(path: ExecutionPath): void {
  if (!_runs.has(path.quantumRunId)) {
    _runs.set(path.quantumRunId, new Map());
  }
  _runs.get(path.quantumRunId)!.set(path.pathId, path);
}

export function updatePath(path: ExecutionPath): void {
  const run = _runs.get(path.quantumRunId);
  if (!run) throw new Error(`[path-registry] Unknown quantumRunId: ${path.quantumRunId}`);
  run.set(path.pathId, path);
}

export function removePath(quantumRunId: string, pathId: string): void {
  _runs.get(quantumRunId)?.delete(pathId);
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getPath(quantumRunId: string, pathId: string): ExecutionPath | undefined {
  return _runs.get(quantumRunId)?.get(pathId);
}

export function getPathsForRun(quantumRunId: string): ExecutionPath[] {
  return Array.from(_runs.get(quantumRunId)?.values() ?? []);
}

export function getPathsByState(
  quantumRunId: string,
  state:        PathLifecycleState,
): ExecutionPath[] {
  return getPathsForRun(quantumRunId).filter(p => p.state === state);
}

export function getCompletedPaths(quantumRunId: string): ExecutionPath[] {
  return getPathsForRun(quantumRunId).filter(
    p => p.state === "VERIFYING" || p.state === "COLLAPSED" || p.state === "MERGING",
  );
}

export function getActivePaths(quantumRunId: string): ExecutionPath[] {
  return getPathsForRun(quantumRunId).filter(
    p => p.state === "RUNNING" || p.state === "SPAWNING",
  );
}

export function getFailedPaths(quantumRunId: string): ExecutionPath[] {
  return getPathsForRun(quantumRunId).filter(
    p => p.state === "FAILED" || p.state === "CANCELLED",
  );
}

export function getBestPath(quantumRunId: string): ExecutionPath | undefined {
  const eligible = getPathsForRun(quantumRunId)
    .filter(p => p.state === "VERIFYING" && p.verificationPassed);
  if (eligible.length === 0) return undefined;
  return eligible.sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
}

export function countByState(quantumRunId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of getPathsForRun(quantumRunId)) {
    counts[p.state] = (counts[p.state] ?? 0) + 1;
  }
  return counts;
}

export function allPathsTerminal(quantumRunId: string): boolean {
  const paths = getPathsForRun(quantumRunId);
  if (paths.length === 0) return false;
  return paths.every(p => ["COLLAPSED", "FAILED", "CANCELLED", "MERGING"].includes(p.state));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearRun(quantumRunId: string): void {
  _runs.delete(quantumRunId);
}

export function clearAll(): void {
  _runs.clear();
}

export function runCount(): number {
  return _runs.size;
}
