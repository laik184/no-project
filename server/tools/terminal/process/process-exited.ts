import { bus } from '../../../infrastructure/index.ts';

export function emitProcessExited(runId: string, pid: number, exitCode: number): void {
  bus.emit(exitCode !== 0 ? 'process.crashed' : 'process.stopped', {
    runId, pid, exitCode, ts: Date.now(),
  });
}
