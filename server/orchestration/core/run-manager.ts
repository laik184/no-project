/**
 * server/orchestration/core/run-manager.ts
 *
 * Central per-run state registry used by orchestration and cleanup consumers.
 * Orchestration-only — no tool execution, no filesystem access.
 */

// ── Per-run metadata ──────────────────────────────────────────────────────────

export interface RunRecord {
  runId:     string;
  projectId: number;
  startedAt: number;
  status:    'active' | 'complete' | 'failed' | 'cancelled';
}

// ── Manager ───────────────────────────────────────────────────────────────────

class RunManager {
  private _runs = new Map<string, RunRecord>();

  register(runId: string, projectId: number): void {
    this._runs.set(runId, {
      runId,
      projectId,
      startedAt: Date.now(),
      status:    'active',
    });
  }

  get(runId: string): RunRecord | undefined {
    return this._runs.get(runId);
  }

  setStatus(runId: string, status: RunRecord['status']): void {
    const rec = this._runs.get(runId);
    if (rec) rec.status = status;
  }

  clear(runId: string): void {
    this._runs.delete(runId);
  }

  activeRunIds(): string[] {
    const ids: string[] = [];
    for (const [id, rec] of this._runs) {
      if (rec.status === 'active') ids.push(id);
    }
    return ids;
  }

  size(): number {
    return this._runs.size;
  }
}

export const runManager = new RunManager();
