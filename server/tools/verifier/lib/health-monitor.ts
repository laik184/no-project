import type { VerificationStatus } from './verifier-types.ts';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface RunRecord {
  runId:      string;
  status:     VerificationStatus | 'running';
  startedAt:  number;
}

const MAX_ACTIVE = 20;
const STUCK_MS   = 5 * 60_000;

class HealthMonitor {
  private readonly runs = new Map<string, RunRecord>();

  registerRun(runId: string): void {
    this.runs.set(runId, { runId, status: 'running', startedAt: Date.now() });
    if (this.runs.size > MAX_ACTIVE * 2) {
      const oldest = [...this.runs.keys()].slice(0, MAX_ACTIVE);
      oldest.forEach((k) => this.runs.delete(k));
    }
  }

  completeRun(runId: string, status: VerificationStatus): void {
    const r = this.runs.get(runId);
    if (r) this.runs.set(runId, { ...r, status });
  }

  getRuns(): string[] {
    return [...this.runs.keys()];
  }

  isHealthy(): boolean {
    return this.getHealthStatus() !== 'unhealthy';
  }

  getHealthStatus(): HealthStatus {
    const active = [...this.runs.values()].filter((r) => r.status === 'running');
    if (active.length > MAX_ACTIVE) return 'unhealthy';
    const now    = Date.now();
    const stuck  = active.filter((r) => now - r.startedAt > STUCK_MS);
    if (stuck.length > 0) return 'degraded';
    return 'healthy';
  }

  activeCount(): number {
    return [...this.runs.values()].filter((r) => r.status === 'running').length;
  }
}

export const healthMonitor = new HealthMonitor();
