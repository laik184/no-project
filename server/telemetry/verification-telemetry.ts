export interface VerificationMetric {
  stage:      string;
  passed:     boolean;
  durationMs: number;
  ts:         number;
}

const metrics: VerificationMetric[] = [];
const MAX = 10_000;

export const verificationTelemetry = {
  record(m: Omit<VerificationMetric, 'ts'>): void {
    if (metrics.length >= MAX) metrics.shift();
    metrics.push({ ...m, ts: Date.now() });
  },
  getAll(): VerificationMetric[] {
    return [...metrics];
  },
  getByStage(stage: string): VerificationMetric[] {
    return metrics.filter(m => m.stage === stage);
  },
  passRate(stage?: string): number {
    const subset = stage ? metrics.filter(m => m.stage === stage) : metrics;
    if (!subset.length) return 1;
    return subset.filter(m => m.passed).length / subset.length;
  },
  clear(): void {
    metrics.length = 0;
  },
};
