interface ExecutionStat {
  runId:      string;
  command:    string;
  success:    boolean;
  durationMs: number;
  timestamp:  Date;
}

const stats: ExecutionStat[] = [];
const MAX_STATS = 1000;

export const executionMetrics = {
  record(runId: string, command: string, success: boolean, durationMs: number): void {
    if (stats.length >= MAX_STATS) stats.shift();
    stats.push({ runId, command, success, durationMs, timestamp: new Date() });
  },

  successRate(runId?: string): number {
    const subset = runId ? stats.filter((s) => s.runId === runId) : stats;
    if (subset.length === 0) return 1;
    return subset.filter((s) => s.success).length / subset.length;
  },

  averageDuration(runId?: string): number {
    const subset = runId ? stats.filter((s) => s.runId === runId) : stats;
    if (subset.length === 0) return 0;
    return subset.reduce((sum, s) => sum + s.durationMs, 0) / subset.length;
  },

  totalExecutions(runId?: string): number {
    return runId ? stats.filter((s) => s.runId === runId).length : stats.length;
  },

  getForRun(runId: string): ExecutionStat[] {
    return stats.filter((s) => s.runId === runId);
  },
};
