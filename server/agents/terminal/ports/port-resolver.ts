import { portRegistry } from './port-registry.ts';
import { findFreePort }  from './port-scanner.ts';

const PORT_RANGE_START = 4000;
const PORT_RANGE_END   = 9999;

export async function resolvePort(runId: string, projectId: string): Promise<number> {
  const existing = portRegistry.getByRun(runId);
  if (existing.length > 0) return existing[0].port;

  const port = await findFreePort(PORT_RANGE_START, PORT_RANGE_END);
  portRegistry.reserve(port, runId, projectId);
  return port;
}

export function releasePort(port: number): void {
  portRegistry.release(port);
}

export function releaseAllForRun(runId: string): void {
  portRegistry.releaseByRun(runId);
}

export function getAssignedPort(runId: string): number | null {
  const allocs = portRegistry.getByRun(runId);
  return allocs.length > 0 ? allocs[0].port : null;
}
