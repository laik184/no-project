import { resolvePort, releasePort, releaseAllForRun, getAssignedPort } from './port-resolver.ts';
import { portRegistry }  from './port-registry.ts';
import { isPortInUse }   from './port-scanner.ts';
import { runtimeLogger } from '../telemetry/runtime-logger.ts';

export const portManager = {
  async acquire(runId: string, projectId: string): Promise<number> {
    const port = await resolvePort(runId, projectId);
    runtimeLogger.info(runId, `[port-manager] Acquired port ${port}`);
    return port;
  },

  release(port: number, runId: string): void {
    releasePort(port);
    runtimeLogger.info(runId, `[port-manager] Released port ${port}`);
  },

  releaseAll(runId: string): void {
    releaseAllForRun(runId);
    runtimeLogger.info(runId, '[port-manager] All ports released');
  },

  getPort(runId: string): number | null {
    return getAssignedPort(runId);
  },

  async isPortReady(port: number): Promise<boolean> {
    return isPortInUse(port);
  },

  listAll() {
    return portRegistry.getAllReserved();
  },
};
