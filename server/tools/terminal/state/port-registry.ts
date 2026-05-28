/**
 * server/tools/terminal/state/port-registry.ts
 *
 * In-process port allocation registry.
 * State store only — no socket binding here.
 */

export interface PortAllocation {
  port:       number;
  runId:      string;
  projectId:  string;
  reservedAt: Date;
}

const byPort = new Map<number, PortAllocation>();
const byRun  = new Map<string, Set<number>>();

function trackRun(runId: string, port: number): void {
  if (!byRun.has(runId)) byRun.set(runId, new Set());
  byRun.get(runId)!.add(port);
}

export const portRegistry = {
  reserve(port: number, runId: string, projectId: string): PortAllocation {
    const alloc: PortAllocation = { port, runId, projectId, reservedAt: new Date() };
    byPort.set(port, alloc);
    trackRun(runId, port);
    return alloc;
  },

  release(port: number): void {
    const alloc = byPort.get(port);
    if (!alloc) return;
    byPort.delete(port);
    byRun.get(alloc.runId)?.delete(port);
  },

  releaseByRun(runId: string): void {
    const ports = byRun.get(runId);
    if (!ports) return;
    for (const port of ports) byPort.delete(port);
    byRun.delete(runId);
  },

  isReserved(port: number): boolean { return byPort.has(port); },

  getByPort(port: number): PortAllocation | undefined { return byPort.get(port); },

  getByRun(runId: string): readonly PortAllocation[] {
    const ports = byRun.get(runId);
    if (!ports) return Object.freeze([]);
    return Object.freeze([...ports].map((p) => byPort.get(p)).filter(Boolean) as PortAllocation[]);
  },

  allReservedPorts(): readonly number[] { return Object.freeze([...byPort.keys()]); },
};
