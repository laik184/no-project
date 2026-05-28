/**
 * server/agents/verifier/monitoring/health-monitor.ts
 * Runtime health tracking for the verifier agent.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';

interface HealthEntry {
  runId:      string;
  phase:      VerificationPhase | 'idle';
  healthy:    boolean;
  lastCheck:  number;
}

const MAX_ACTIVE_RUNS    = 20;
const STUCK_THRESHOLD_MS = 5 * 60_000;

const entries = new Map<string, HealthEntry>();
const runStartTimes = new Map<string, number>();

export type HealthState = 'healthy' | 'degraded' | 'unhealthy';

export const verifierHealthMonitor = {
  onRunStart(runId: string): void {
    runStartTimes.set(runId, Date.now());
    entries.set(runId, { runId, phase: 'idle', healthy: true, lastCheck: Date.now() });
  },

  onPhaseChange(runId: string, phase: VerificationPhase | 'idle'): void {
    const e = entries.get(runId);
    if (e) { e.phase = phase; e.lastCheck = Date.now(); }
  },

  onRunComplete(runId: string, passed: boolean): void {
    const e = entries.get(runId);
    if (e) { e.healthy = passed; e.phase = 'idle'; }
    runStartTimes.delete(runId);
  },

  getState(): HealthState {
    const active = [...runStartTimes.values()];
    if (active.length > MAX_ACTIVE_RUNS) return 'unhealthy';
    const now    = Date.now();
    const stuck  = active.filter((t) => now - t > STUCK_THRESHOLD_MS);
    if (stuck.length > 0) return 'degraded';
    return 'healthy';
  },

  isHealthy(): boolean { return this.getState() !== 'unhealthy'; },

  activeCount(): number { return runStartTimes.size; },
};
