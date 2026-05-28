import type { VerificationPhase } from './types.ts';
import { runLogger } from '../../orchestration/telemetry/run-logger.ts';
import { metricsCollector } from '../../orchestration/telemetry/metrics.ts';

const PREFIX = '[verifier]';

export const verifierLogger = {
  info(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'info', `${PREFIX} ${message}`, meta);
  },
  warn(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'warn', `${PREFIX} ${message}`, meta);
  },
  error(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'error', `${PREFIX} ${message}`, meta);
  },
  debug(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'debug', `${PREFIX} ${message}`, meta);
  },
  phase(runId: string, phase: string, event: 'start' | 'end' | 'fail', meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'info', `${PREFIX} [${phase}] ${event}`, meta);
  },
};

export const verifierMetrics = {
  recordPhase(runId: string, phase: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, `verifier.phase.${phase}`, durationMs);
    metricsCollector.increment(runId, passed ? 'verifier.phases.passed' : 'verifier.phases.failed');
  },
  recordVerification(runId: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, 'verifier.total', durationMs);
    metricsCollector.increment(runId, passed ? 'verifier.runs.passed' : 'verifier.runs.failed');
  },
  recordBuildSuccess(runId: string): void {
    metricsCollector.increment(runId, 'verifier.build.success');
  },
  recordBuildFailure(runId: string): void {
    metricsCollector.increment(runId, 'verifier.build.failure');
  },
  recordTestRun(runId: string, passed: number, failed: number): void {
    metricsCollector.increment(runId, 'verifier.tests.passed', passed);
    metricsCollector.increment(runId, 'verifier.tests.failed', failed);
  },
  recordCrash(runId: string): void {
    metricsCollector.increment(runId, 'verifier.runtime.crashes');
  },
  getSnapshot(runId: string) {
    return metricsCollector.getSnapshot(runId);
  },
  clear(runId: string): void {
    metricsCollector.clearRun(runId);
  },
};

interface PhaseTimer { phase: VerificationPhase; startedAt: number; }
const activeTimers = new Map<string, Map<VerificationPhase, PhaseTimer>>();
const completedMs  = new Map<string, Map<VerificationPhase, number>>();

function getTimers(runId: string): Map<VerificationPhase, PhaseTimer> {
  if (!activeTimers.has(runId)) activeTimers.set(runId, new Map());
  return activeTimers.get(runId)!;
}
function getCompleted(runId: string): Map<VerificationPhase, number> {
  if (!completedMs.has(runId)) completedMs.set(runId, new Map());
  return completedMs.get(runId)!;
}

export const performanceTracker = {
  startPhase(runId: string, phase: VerificationPhase): void {
    getTimers(runId).set(phase, { phase, startedAt: Date.now() });
  },
  endPhase(runId: string, phase: VerificationPhase): number {
    const timer = getTimers(runId).get(phase);
    if (!timer) return 0;
    const durationMs = Date.now() - timer.startedAt;
    getCompleted(runId).set(phase, durationMs);
    getTimers(runId).delete(phase);
    return durationMs;
  },
  getDuration(runId: string, phase: VerificationPhase): number {
    return getCompleted(runId).get(phase) ?? 0;
  },
  getAllDurations(runId: string): Record<string, number> {
    return Object.fromEntries(getCompleted(runId).entries());
  },
  getTotalDuration(runId: string): number {
    let total = 0;
    for (const ms of getCompleted(runId).values()) total += ms;
    return total;
  },
  clear(runId: string): void {
    activeTimers.delete(runId);
    completedMs.delete(runId);
  },
};

interface TraceEntry {
  phase:     VerificationPhase | 'overall';
  event:     string;
  timestamp: Date;
  meta?:     Record<string, unknown>;
}
const traces = new Map<string, TraceEntry[]>();

function getOrCreate(runId: string): TraceEntry[] {
  if (!traces.has(runId)) traces.set(runId, []);
  return traces.get(runId)!;
}

export const executionTrace = {
  record(runId: string, phase: VerificationPhase | 'overall', event: string, meta?: Record<string, unknown>): void {
    getOrCreate(runId).push({ phase, event, timestamp: new Date(), meta });
  },
  getAll(runId: string): TraceEntry[] {
    return traces.get(runId) ?? [];
  },
  getForPhase(runId: string, phase: VerificationPhase): TraceEntry[] {
    return (traces.get(runId) ?? []).filter((e) => e.phase === phase);
  },
  clear(runId: string): void {
    traces.delete(runId);
  },
  export(runId: string): string {
    return (traces.get(runId) ?? [])
      .map((e) => {
        const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : '';
        return `[${e.timestamp.toISOString()}][${e.phase}] ${e.event}${meta}`;
      })
      .join('\n');
  },
};
