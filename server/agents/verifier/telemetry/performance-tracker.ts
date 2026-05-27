import type { VerificationPhase } from '../types/verifier.types.ts';

interface PhaseTimer {
  phase:     VerificationPhase;
  startedAt: number;
}

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
