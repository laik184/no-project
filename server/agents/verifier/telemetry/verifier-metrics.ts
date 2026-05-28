/**
 * telemetry/verifier-metrics.ts
 * In-memory metrics for the verifier orchestration agent.
 */

interface Counter  { [key: string]: number }
interface GaugeBag { [key: string]: number }
interface Timing   { label: string; durationMs: number; timestamp: Date }

const counters  = new Map<string, Counter>();
const gauges    = new Map<string, GaugeBag>();
const timings   = new Map<string, Timing[]>();

function getCounter(runId: string): Counter {
  if (!counters.has(runId)) counters.set(runId, {});
  return counters.get(runId)!;
}
function getGauge(runId: string): GaugeBag {
  if (!gauges.has(runId)) gauges.set(runId, {});
  return gauges.get(runId)!;
}
function getTimings(runId: string): Timing[] {
  if (!timings.has(runId)) timings.set(runId, []);
  return timings.get(runId)!;
}

export const verifierMetrics = {
  increment(runId: string, key: string, by = 1): void {
    const c = getCounter(runId);
    c[key] = (c[key] ?? 0) + by;
  },
  gauge(runId: string, key: string, value: number): void {
    getGauge(runId)[key] = value;
  },
  timing(runId: string, label: string, durationMs: number): void {
    getTimings(runId).push({ label, durationMs, timestamp: new Date() });
  },
  recordPhase(runId: string, phase: string, durationMs: number, passed: boolean): void {
    this.timing(runId, `phase.${phase}`, durationMs);
    this.increment(runId, passed ? `phase.${phase}.passed` : `phase.${phase}.failed`);
    this.increment(runId, passed ? 'phases.passed' : 'phases.failed');
  },
  recordVerification(runId: string, durationMs: number, passed: boolean): void {
    this.timing(runId, 'verification.total', durationMs);
    this.increment(runId, passed ? 'runs.passed' : 'runs.failed');
  },
  recordDispatch(runId: string, toolName: string, durationMs: number, ok: boolean): void {
    this.timing(runId, `dispatch.${toolName}`, durationMs);
    this.increment(runId, ok ? `dispatch.${toolName}.ok` : `dispatch.${toolName}.fail`);
  },
  recordRetry(runId: string, toolName: string): void {
    this.increment(runId, `retries.${toolName}`);
    this.increment(runId, 'retries.total');
  },
  snapshot(runId: string): Record<string, unknown> {
    return {
      counters: { ...(counters.get(runId) ?? {}) },
      gauges:   { ...(gauges.get(runId) ?? {}) },
      timings:  (timings.get(runId) ?? []).slice(-20),
    };
  },
  clear(runId: string): void {
    counters.delete(runId);
    gauges.delete(runId);
    timings.delete(runId);
  },
};
