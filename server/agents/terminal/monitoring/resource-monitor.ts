import { getProcessMemoryMb } from '../utils/process-utils.ts';
import { processRegistry }    from '../process/process-registry.ts';
import type { ResourceSnapshot } from '../types/runtime.types.ts';

const MAX_MEMORY_MB   = 512;
const MAX_PROCESSES   = 20;

export const resourceMonitor = {
  snapshot(): ResourceSnapshot {
    const procs = processRegistry.listRunning();
    let totalMem = 0;
    for (const p of procs) {
      const mem = getProcessMemoryMb(p.pid);
      if (mem !== null) totalMem += mem;
    }

    return {
      memoryUsedMb:    totalMem,
      cpuPercent:      0,           // Lightweight — skip expensive CPU sampling
      activeProcesses: procs.length,
      capturedAt:      new Date(),
    };
  },

  isMemoryOk(): boolean {
    return resourceMonitor.snapshot().memoryUsedMb <= MAX_MEMORY_MB;
  },

  isProcessCountOk(): boolean {
    return processRegistry.listRunning().length <= MAX_PROCESSES;
  },

  isHealthy(): boolean {
    return resourceMonitor.isMemoryOk() && resourceMonitor.isProcessCountOk();
  },
};
