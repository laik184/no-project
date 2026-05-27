import { processManager }    from './process-manager.ts';
import { processHistory }    from './process-history.ts';
import { runtimeLogger }     from '../telemetry/runtime-logger.ts';
import type { ProcessRecord } from '../types/process.types.ts';

export async function onProcessStarted(
  runId:   string,
  command: string,
  pid:     number,
): Promise<ProcessRecord> {
  return processManager.register(runId, command, pid);
}

export function onProcessExited(
  id:         string,
  exitCode:   number,
  durationMs: number,
): void {
  const record = processManager.get(id);
  if (!record) return;

  if (exitCode === 0) {
    processManager.markStopped(id, exitCode);
  } else {
    processManager.markCrashed(id);
  }

  processHistory.record({
    processId:  id,
    runId:      record.runId,
    command:    record.command,
    exitCode,
    durationMs,
    status:     exitCode === 0 ? 'stopped' : 'crashed',
    timestamp:  new Date(),
  });
}

export function cleanupRun(runId: string): void {
  processManager.clearRun(runId);
  runtimeLogger.info(runId, '[process-lifecycle] Run cleaned up');
}
