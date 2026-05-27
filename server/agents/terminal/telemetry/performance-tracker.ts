interface PerfSample {
  runId:      string;
  command:    string;
  durationMs: number;
  memoryMb?:  number;
  timestamp:  Date;
}

const samples: PerfSample[] = [];
const MAX_SAMPLES = 500;

export const performanceTracker = {
  record(runId: string, command: string, durationMs: number, memoryMb?: number): void {
    if (samples.length >= MAX_SAMPLES) samples.shift();
    samples.push({ runId, command, durationMs, memoryMb, timestamp: new Date() });
  },

  averageDuration(runId?: string): number {
    const subset = runId ? samples.filter((s) => s.runId === runId) : samples;
    if (subset.length === 0) return 0;
    return subset.reduce((sum, s) => sum + s.durationMs, 0) / subset.length;
  },

  slowestCommands(n = 5): PerfSample[] {
    return [...samples].sort((a, b) => b.durationMs - a.durationMs).slice(0, n);
  },

  getForRun(runId: string): PerfSample[] {
    return samples.filter((s) => s.runId === runId);
  },

  clear(runId: string): void {
    const idx = samples.findIndex((s) => s.runId === runId);
    while (idx !== -1) samples.splice(idx, 1);
  },
};
