/**
 * server/orchestration/core/orchestration-replay.ts
 *
 * Orchestration replay: stores per-run checkpoints for replay consumers
 * and provides cleanup helpers for the memory lifecycle manager.
 * Orchestration-only — no tool execution, no filesystem access.
 */

// ── Per-run checkpoint store ───────────────────────────────────────────────────

const _store = new Map<string, unknown[]>();

export function storeCheckpoint(runId: string, checkpoint: unknown): void {
  const list = _store.get(runId) ?? [];
  list.push(checkpoint);
  _store.set(runId, list);
}

export function getCheckpoints(runId: string): unknown[] {
  return _store.get(runId) ?? [];
}

export function clearCheckpoints(runId: string): void {
  _store.delete(runId);
}
