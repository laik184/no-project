/**
 * server/agents/coderx/monitoring/failure-monitor.ts
 *
 * Tracks failed executions, retry attempts, and repeated failures.
 * Pure observation — no execution, no dispatcher calls.
 */

import type { CodingFailureRecord, CodingTaskKind } from '../types/coderx.types.ts';
import { now } from '../utils/coding-utils.ts';

const _failures = new Map<string, CodingFailureRecord[]>();

export const failureMonitor = {

  record(record: CodingFailureRecord): void {
    const key = record.runId;
    const existing = _failures.get(key) ?? [];
    existing.push(record);
    _failures.set(key, existing);
  },

  getFailures(runId: string): CodingFailureRecord[] {
    return _failures.get(runId) ?? [];
  },

  getFailureCount(runId: string): number {
    return (_failures.get(runId) ?? []).length;
  },

  hasRepeatedFailure(runId: string, toolName: string, threshold = 3): boolean {
    const records = _failures.get(runId) ?? [];
    const count   = records.filter((r) => r.toolName === toolName).length;
    return count >= threshold;
  },

  getMostFailedTool(runId: string): string | null {
    const records = _failures.get(runId) ?? [];
    if (records.length === 0) return null;

    const counts = new Map<string, number>();
    for (const r of records) {
      counts.set(r.toolName, (counts.get(r.toolName) ?? 0) + 1);
    }

    let maxTool  = '';
    let maxCount = 0;
    for (const [tool, count] of counts) {
      if (count > maxCount) { maxCount = count; maxTool = tool; }
    }
    return maxTool || null;
  },

  summarize(runId: string): {
    total:    number;
    byKind:   Record<string, number>;
    byTool:   Record<string, number>;
    repeated: string[];
  } {
    const records = _failures.get(runId) ?? [];
    const byKind: Record<string, number> = {};
    const byTool: Record<string, number> = {};

    for (const r of records) {
      byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
      byTool[r.toolName] = (byTool[r.toolName] ?? 0) + 1;
    }

    const repeated = Object.entries(byTool)
      .filter(([, count]) => count >= 3)
      .map(([tool]) => tool);

    return { total: records.length, byKind, byTool, repeated };
  },

  buildRecord(
    stepId:     string,
    taskId:     string,
    runId:      string,
    kind:       CodingTaskKind,
    toolName:   string,
    error:      string,
    retryCount: number,
  ): CodingFailureRecord {
    return { stepId, taskId, runId, kind, toolName, error, retryCount, timestamp: now() };
  },

  clearRun(runId: string): void {
    _failures.delete(runId);
  },
};
