import type { ProcessRecord, ProcessStatus } from '../types/process.types.ts';
import { generateProcessId } from '../utils/process-utils.ts';

const registry = new Map<string, ProcessRecord>();

export const processRegistry = {
  register(runId: string, command: string, pid: number): ProcessRecord {
    const record: ProcessRecord = {
      id:        generateProcessId(),
      runId,
      command,
      pid,
      status:    'running',
      startedAt: new Date(),
    };
    registry.set(record.id, record);
    return record;
  },

  setStatus(id: string, status: ProcessStatus, exitCode?: number): void {
    const r = registry.get(id);
    if (!r) return;
    r.status    = status;
    r.stoppedAt = new Date();
    if (exitCode !== undefined) r.exitCode = exitCode;
  },

  get(id: string): ProcessRecord | undefined {
    return registry.get(id);
  },

  getByPid(pid: number): ProcessRecord | undefined {
    return Array.from(registry.values()).find((r) => r.pid === pid);
  },

  listByRun(runId: string): ProcessRecord[] {
    return Array.from(registry.values()).filter((r) => r.runId === runId);
  },

  listRunning(): ProcessRecord[] {
    return Array.from(registry.values()).filter((r) => r.status === 'running');
  },

  clearRun(runId: string): void {
    for (const [id, r] of registry.entries()) {
      if (r.runId === runId) registry.delete(id);
    }
  },

  size(): number { return registry.size; },
};
