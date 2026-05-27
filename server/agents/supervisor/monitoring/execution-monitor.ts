import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionHealth, LoopRiskLevel } from '../types/supervisor.types.ts';
import { loopDetector } from './loop-detector.ts';
import { stuckTaskDetector } from './stuck-task-detector.ts';
import { timeoutMonitor } from './timeout-monitor.ts';

interface RunSnapshot {
  runId: string;
  startedAt: Date;
  currentPhase: OrchestrationPhase | null;
  retryCount: number;
}

const activeRuns = new Map<string, RunSnapshot>();

export const executionMonitor = {
  track(runId: string, snapshot: Omit<RunSnapshot, 'runId'>): void {
    activeRuns.set(runId, { runId, ...snapshot });
  },

  update(runId: string, patch: Partial<Omit<RunSnapshot, 'runId'>>): void {
    const existing = activeRuns.get(runId);
    if (existing) activeRuns.set(runId, { ...existing, ...patch });
  },

  checkHealth(runId: string): ExecutionHealth {
    const snap = activeRuns.get(runId);
    const stuckTasks = stuckTaskDetector.getStuckTasks(runId);
    const timedOut = snap?.currentPhase && timeoutMonitor.isTimedOut(runId, snap.currentPhase)
      ? [snap.currentPhase]
      : [] as OrchestrationPhase[];

    const loopResult = loopDetector.detectGlobal(runId);
    const retryExhausted = snap && snap.retryCount >= 5 ? [runId] : [];

    const healthy = stuckTasks.length === 0 &&
      timedOut.length === 0 &&
      retryExhausted.length === 0 &&
      loopResult.risk === 'none';

    return {
      runId,
      healthy,
      stuckTasks,
      timedOutPhases: timedOut,
      retryExhausted,
      loopRisk: loopResult.risk,
      checkedAt: new Date(),
    };
  },

  getLoopRisk(runId: string, phase: OrchestrationPhase): LoopRiskLevel {
    return loopDetector.detect(runId, phase).risk;
  },

  untrack(runId: string): void {
    activeRuns.delete(runId);
    stuckTaskDetector.clearRun(runId);
    timeoutMonitor.clearRun(runId);
    loopDetector.clearRun(runId);
  },

  activeRunCount(): number {
    return activeRuns.size;
  },
};
