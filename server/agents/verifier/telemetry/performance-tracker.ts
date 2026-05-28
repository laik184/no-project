/**
 * telemetry/performance-tracker.ts
 * Phase and step timing tracker.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';

interface ActiveTimer {
  startedAt: number;
  label:     string;
}

const activeTimers    = new Map<string, Map<string, ActiveTimer>>();
const completedTimers = new Map<string, Map<string, number>>();

function getActive(runId: string): Map<string, ActiveTimer> {
  if (!activeTimers.has(runId)) activeTimers.set(runId, new Map());
  return activeTimers.get(runId)!;
}
function getCompleted(runId: string): Map<string, number> {
  if (!completedTimers.has(runId)) completedTimers.set(runId, new Map());
  return completedTimers.get(runId)!;
}

export const performanceTracker = {
  start(runId: string, key: string): void {
    getActive(runId).set(key, { startedAt: Date.now(), label: key });
  },

  end(runId: string, key: string): number {
    const timer = getActive(runId).get(key);
    if (!timer) return 0;
    const durationMs = Date.now() - timer.startedAt;
    getCompleted(runId).set(key, durationMs);
    getActive(runId).delete(key);
    return durationMs;
  },

  startPhase(runId: string, phase: VerificationPhase): void {
    this.start(runId, `phase:${phase}`);
  },

  endPhase(runId: string, phase: VerificationPhase): number {
    return this.end(runId, `phase:${phase}`);
  },

  get(runId: string, key: string): number {
    return getCompleted(runId).get(key) ?? 0;
  },

  getPhase(runId: string, phase: VerificationPhase): number {
    return this.get(runId, `phase:${phase}`);
  },

  totalDuration(runId: string): number {
    let total = 0;
    for (const ms of getCompleted(runId).values()) total += ms;
    return total;
  },

  allDurations(runId: string): Record<string, number> {
    return Object.fromEntries(getCompleted(runId).entries());
  },

  clear(runId: string): void {
    activeTimers.delete(runId);
    completedTimers.delete(runId);
  },
};
