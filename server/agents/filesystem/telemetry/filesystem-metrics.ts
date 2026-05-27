import type { OperationType } from '../types/filesystem.types.ts';

interface RunMetrics {
  total:   number;
  success: number;
  failed:  number;
  byType:  Partial<Record<OperationType, number>>;
}

const store = new Map<string, RunMetrics>();

export const filesystemMetrics = {
  recordStart(runId: string, type: OperationType): void {
    if (!store.has(runId)) store.set(runId, { total: 0, success: 0, failed: 0, byType: {} });
    const m = store.get(runId)!;
    m.total++;
    m.byType[type] = (m.byType[type] ?? 0) + 1;
  },

  recordEnd(runId: string, _type: OperationType, success: boolean): void {
    const m = store.get(runId);
    if (!m) return;
    if (success) m.success++; else m.failed++;
  },

  get(runId: string): RunMetrics | undefined {
    return store.get(runId);
  },

  clear(runId: string): void {
    store.delete(runId);
  },
};
