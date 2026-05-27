import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode } from '../types/supervisor.types.ts';
import { phaseTimeout } from '../utils/supervisor-helpers.ts';

interface PhaseTimer {
  phase: OrchestrationPhase;
  startedAt: number;
  deadlineMs: number;
  mode: ExecutionMode;
}

const phaseTimers = new Map<string, Map<OrchestrationPhase, PhaseTimer>>();

function runTimers(runId: string): Map<OrchestrationPhase, PhaseTimer> {
  if (!phaseTimers.has(runId)) phaseTimers.set(runId, new Map());
  return phaseTimers.get(runId)!;
}

export const timeoutMonitor = {
  startPhase(runId: string, phase: OrchestrationPhase, mode: ExecutionMode, overrideMs?: number): void {
    const deadlineMs = overrideMs ?? phaseTimeout(phase, mode);
    runTimers(runId).set(phase, {
      phase,
      startedAt: Date.now(),
      deadlineMs,
      mode,
    });
  },

  endPhase(runId: string, phase: OrchestrationPhase): void {
    runTimers(runId).delete(phase);
  },

  isTimedOut(runId: string, phase: OrchestrationPhase): boolean {
    const timer = runTimers(runId).get(phase);
    if (!timer) return false;
    return Date.now() - timer.startedAt > timer.deadlineMs;
  },

  remainingMs(runId: string, phase: OrchestrationPhase): number {
    const timer = runTimers(runId).get(phase);
    if (!timer) return 0;
    return Math.max(0, timer.deadlineMs - (Date.now() - timer.startedAt));
  },

  elapsedMs(runId: string, phase: OrchestrationPhase): number {
    const timer = runTimers(runId).get(phase);
    if (!timer) return 0;
    return Date.now() - timer.startedAt;
  },

  getTimedOutPhases(runId: string): OrchestrationPhase[] {
    const timers = runTimers(runId);
    const now = Date.now();
    return Array.from(timers.values())
      .filter((t) => now - t.startedAt > t.deadlineMs)
      .map((t) => t.phase);
  },

  clearRun(runId: string): void {
    phaseTimers.delete(runId);
  },
};
