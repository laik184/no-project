/**
 * server/agents/filesystem/monitoring/failure-monitor.ts
 *
 * Tracks failed operations, retry attempts, repeated failures, and stuck loops.
 * Pure in-process monitor — no filesystem access, no external deps.
 */

import type {
  FilesystemFailureRecord,
  FilesystemOperationKind,
} from '../types/filesystem.types.ts';

// ── Internal store ────────────────────────────────────────────────────────────

const _failures = new Map<string, FilesystemFailureRecord[]>();
const STUCK_THRESHOLD     = 5;   // retries before "stuck" alert
const REPEATED_THRESHOLD  = 3;   // same operationId failures = repeated failure

// ── Public API ────────────────────────────────────────────────────────────────

export const failureMonitor = {
  /** Record a new failure for an operation. */
  record(
    operationId: string,
    runId:       string,
    kind:        FilesystemOperationKind,
    error:       string,
    retryCount:  number,
  ): void {
    const record: FilesystemFailureRecord = {
      operationId,
      runId,
      kind,
      error,
      retryCount,
      timestamp: new Date(),
    };

    const existing = _failures.get(operationId) ?? [];
    existing.push(record);
    _failures.set(operationId, existing);

    if (retryCount >= STUCK_THRESHOLD) {
      console.warn(
        `[failure-monitor] Stuck operation detected — operationId=${operationId} runId=${runId} kind=${kind} retries=${retryCount}`,
      );
    }

    if (existing.length >= REPEATED_THRESHOLD) {
      console.warn(
        `[failure-monitor] Repeated failure — operationId=${operationId} occurrences=${existing.length} lastError="${error}"`,
      );
    }
  },

  /** Returns true if an operation has exceeded the stuck threshold. */
  isStuck(operationId: string): boolean {
    const records = _failures.get(operationId);
    if (!records || records.length === 0) return false;
    const last = records[records.length - 1];
    return last.retryCount >= STUCK_THRESHOLD;
  },

  /** Returns all failure records for a given operation. */
  getFailures(operationId: string): FilesystemFailureRecord[] {
    return _failures.get(operationId) ?? [];
  },

  /** Returns the total failure count for an operation. */
  failureCount(operationId: string): number {
    return _failures.get(operationId)?.length ?? 0;
  },

  /** Returns all currently tracked failures across all operations. */
  allFailures(): FilesystemFailureRecord[] {
    return [..._failures.values()].flat();
  },

  /** Returns a summary snapshot for diagnostics. */
  summary(): {
    totalOperationsFailed: number;
    stuckOperations: string[];
    repeatedFailures: string[];
  } {
    const stuckOperations:    string[] = [];
    const repeatedFailures:   string[] = [];

    for (const [operationId, records] of _failures) {
      if (records.length === 0) continue;
      const last = records[records.length - 1];
      if (last.retryCount >= STUCK_THRESHOLD)   stuckOperations.push(operationId);
      if (records.length >= REPEATED_THRESHOLD)  repeatedFailures.push(operationId);
    }

    return {
      totalOperationsFailed: _failures.size,
      stuckOperations,
      repeatedFailures,
    };
  },

  /** Evict records for a completed/succeeded operation. */
  clear(operationId: string): void {
    _failures.delete(operationId);
  },

  /** Reset all tracking state (tests / agent restart). */
  reset(): void {
    _failures.clear();
  },
};
