import { processRegistry }    from './process-registry.ts';
import { publishEvent }       from '../events/event-publisher.ts';
import { runtimeLogger }      from '../telemetry/runtime-logger.ts';
import { killProcess }        from '../utils/process-utils.ts';
import type { ProcessRecord } from '../types/process.types.ts';

export const processManager = {
  register(runId: string, command: string, pid: number): ProcessRecord {
    const record = processRegistry.register(runId, command, pid);
    runtimeLogger.info(runId, `[process-manager] Registered pid=${pid}`, { id: record.id, command });
    publishEvent('terminal.execution.started', {
      runId, command, projectId: runId, timestamp: new Date(),
    });
    return record;
  },

  markStopped(id: string, exitCode: number): void {
    const record = processRegistry.get(id);
    if (!record) return;
    processRegistry.setStatus(id, 'stopped', exitCode);
    runtimeLogger.info(record.runId, `[process-manager] Stopped pid=${record.pid} exit=${exitCode}`);
  },

  markCrashed(id: string): void {
    const record = processRegistry.get(id);
    if (!record) return;
    processRegistry.setStatus(id, 'crashed');
    runtimeLogger.warn(record.runId, `[process-manager] Crashed pid=${record.pid}`);
    publishEvent('process.crashed', {
      runId: record.runId, processId: id,
      pid: record.pid, exitCode: -1, timestamp: new Date(),
    });
  },

  killProcess(id: string): void {
    const record = processRegistry.get(id);
    if (!record) return;
    killProcess(record.pid, 'SIGTERM');
    processRegistry.setStatus(id, 'killed');
    runtimeLogger.info(record.runId, `[process-manager] Killed pid=${record.pid}`);
  },

  get:        (id: string)    => processRegistry.get(id),
  listByRun:  (runId: string) => processRegistry.listByRun(runId),
  listRunning: ()             => processRegistry.listRunning(),
  clearRun:   (runId: string) => processRegistry.clearRun(runId),
};
