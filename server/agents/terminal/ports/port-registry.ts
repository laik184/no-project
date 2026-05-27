export interface PortAllocation {
  port:      number;
  runId:     string;
  projectId: string;
  reservedAt: Date;
}

const registry = new Map<number, PortAllocation>();

export const portRegistry = {
  reserve(port: number, runId: string, projectId: string): void {
    registry.set(port, { port, runId, projectId, reservedAt: new Date() });
  },

  release(port: number): void {
    registry.delete(port);
  },

  releaseByRun(runId: string): void {
    for (const [port, alloc] of registry.entries()) {
      if (alloc.runId === runId) registry.delete(port);
    }
  },

  isReserved(port: number): boolean {
    return registry.has(port);
  },

  getByRun(runId: string): PortAllocation[] {
    return Array.from(registry.values()).filter((a) => a.runId === runId);
  },

  getAllReserved(): PortAllocation[] {
    return Array.from(registry.values());
  },

  size(): number { return registry.size; },
};
