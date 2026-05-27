export interface ResourceSnapshot {
  runId:    string;
  memoryMb: number;
  cpuPct:   number;
  ts:       number;
}

const snapshots = new Map<string, ResourceSnapshot[]>();

export const resourceMonitor = {
  record(runId: string, memoryMb: number, cpuPct: number): void {
    if (!snapshots.has(runId)) snapshots.set(runId, []);
    const list = snapshots.get(runId)!;
    if (list.length > 100) list.shift();
    list.push({ runId, memoryMb, cpuPct, ts: Date.now() });
  },
  getLast(runId: string): ResourceSnapshot | undefined {
    const list = snapshots.get(runId) ?? [];
    return list[list.length - 1];
  },
  isOverMemory(runId: string, limitMb = 512): boolean {
    return (this.getLast(runId)?.memoryMb ?? 0) > limitMb;
  },
  clear(runId: string): void { snapshots.delete(runId); },
};
