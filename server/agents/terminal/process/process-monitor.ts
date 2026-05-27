import { processRegistry }     from './process-registry.ts';
import { isProcessAlive }      from '../utils/process-utils.ts';
import { processManager }      from './process-manager.ts';
import { runtimeLogger }       from '../telemetry/runtime-logger.ts';

const POLL_INTERVAL_MS = 5_000;
let   pollTimer: NodeJS.Timeout | null = null;

export const processMonitor = {
  start(): void {
    if (pollTimer) return;
    pollTimer = setInterval(() => processMonitor.checkAll(), POLL_INTERVAL_MS);
    pollTimer.unref?.();
  },

  stop(): void {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  },

  checkAll(): void {
    const running = processRegistry.listRunning();
    for (const record of running) {
      if (!isProcessAlive(record.pid)) {
        runtimeLogger.warn(record.runId, `[process-monitor] pid=${record.pid} is dead — marking crashed`);
        processManager.markCrashed(record.id);
      }
    }
  },

  isAlive(id: string): boolean {
    const record = processRegistry.get(id);
    return record ? isProcessAlive(record.pid) : false;
  },
};
