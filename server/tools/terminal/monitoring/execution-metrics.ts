export interface ExecutionMetric {
  runId:      string;
  tool:       string;
  durationMs: number;
  success:    boolean;
  ts:         number;
}

const metrics: ExecutionMetric[] = [];
const MAX = 10_000;

export const executionMetrics = {
  record(m: Omit<ExecutionMetric, 'ts'>): void {
    if (metrics.length >= MAX) metrics.shift();
    metrics.push({ ...m, ts: Date.now() });
  },
  getByRun(runId: string): ExecutionMetric[] {
    return metrics.filter(m => m.runId === runId);
  },
  avgDuration(tool: string): number {
    const subset = metrics.filter(m => m.tool === tool);
    if (!subset.length) return 0;
    return subset.reduce((s, m) => s + m.durationMs, 0) / subset.length;
  },
  successRate(runId?: string): number {
    const subset = runId ? metrics.filter(m => m.runId === runId) : metrics;
    if (!subset.length) return 1;
    return subset.filter(m => m.success).length / subset.length;
  },
  clear(runId?: string): void {
    if (!runId) { metrics.length = 0; return; }
    const toRemove = metrics.filter(m => m.runId === runId);
    for (const m of toRemove) metrics.splice(metrics.indexOf(m), 1);
  },
};
