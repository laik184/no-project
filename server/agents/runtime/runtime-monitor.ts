import { probePort } from '../../runtime/health/port-probe.ts';

export interface RuntimeStatus {
  projectId:  number;
  port?:      number;
  alive:      boolean;
  checkedAt:  number;
}

interface RunHealth {
  steps:    number;
  failures: number;
}

const cache   = new Map<number, RuntimeStatus>();
const health  = new Map<string, RunHealth>();

export const runtimeMonitor = {
  async check(projectId: number, port?: number): Promise<RuntimeStatus> {
    const alive = port ? await probePort(port) : false;
    const status: RuntimeStatus = { projectId, port, alive, checkedAt: Date.now() };
    cache.set(projectId, status);
    return status;
  },

  last(projectId: number): RuntimeStatus | undefined {
    return cache.get(projectId);
  },

  clear(projectId: number): void {
    cache.delete(projectId);
  },

  recordStep(runId: string, success: boolean): void {
    if (!health.has(runId)) health.set(runId, { steps: 0, failures: 0 });
    const h = health.get(runId)!;
    h.steps++;
    if (!success) h.failures++;
  },

  isHealthy(runId: string): boolean {
    const h = health.get(runId);
    if (!h || h.steps === 0) return true;
    return h.failures / h.steps < 0.5;
  },

  clearRun(runId: string): void {
    health.delete(runId);
  },
};
