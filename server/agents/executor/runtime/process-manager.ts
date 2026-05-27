import { executorLogger } from '../telemetry/executor-logger.ts';

export type ProcessStatus = 'running' | 'stopped' | 'crashed';

export interface ManagedProcess {
  id:        string;
  runId:     string;
  command:   string;
  pid:       number;
  status:    ProcessStatus;
  startedAt: Date;
  stoppedAt?: Date;
}

const registry = new Map<string, ManagedProcess>();

export const processManager = {
  register(id: string, runId: string, command: string, pid: number): ManagedProcess {
    const proc: ManagedProcess = {
      id, runId, command, pid,
      status:    'running',
      startedAt: new Date(),
    };
    registry.set(id, proc);
    executorLogger.info(runId, `Process registered: ${command} (pid=${pid})`, { id });
    return proc;
  },

  markStopped(id: string): void {
    const proc = registry.get(id);
    if (!proc) return;
    proc.status    = 'stopped';
    proc.stoppedAt = new Date();
  },

  markCrashed(id: string): void {
    const proc = registry.get(id);
    if (!proc) return;
    proc.status    = 'crashed';
    proc.stoppedAt = new Date();
  },

  get(id: string): ManagedProcess | undefined {
    return registry.get(id);
  },

  listByRun(runId: string): ManagedProcess[] {
    return Array.from(registry.values()).filter((p) => p.runId === runId);
  },

  listRunning(): ManagedProcess[] {
    return Array.from(registry.values()).filter((p) => p.status === 'running');
  },

  clearRun(runId: string): void {
    for (const [id, proc] of registry.entries()) {
      if (proc.runId === runId) registry.delete(id);
    }
  },
};
