import { isPortInUse } from '../ports/find-free-port.ts';

export interface RuntimeHealth {
  runId:     string;
  port?:     number;
  alive:     boolean;
  checkedAt: number;
}

const health = new Map<string, RuntimeHealth>();

export const runtimeMonitor = {
  async check(runId: string, port?: number): Promise<RuntimeHealth> {
    const alive = port ? await isPortInUse(port) : false;
    const h: RuntimeHealth = { runId, port, alive, checkedAt: Date.now() };
    health.set(runId, h);
    return h;
  },
  last(runId: string): RuntimeHealth | undefined { return health.get(runId); },
  clear(runId: string): void { health.delete(runId); },
};
