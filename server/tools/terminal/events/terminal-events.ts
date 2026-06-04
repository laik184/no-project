/**
 * server/tools/terminal/events/terminal-events.ts
 *
 * Single point of bus access for the terminal tool layer.
 * Only this file may import infrastructure bus — process-started.ts
 * and process-exited.ts call these helpers instead.
 */
import { bus } from '../../../infrastructure/index.ts';

export function emitProcessStarted(runId: string, pid: number, command: string, port?: number): void {
  bus.emit('process.started', { runId, pid, command, port, ts: Date.now() });
}

export function emitProcessExited(runId: string, pid: number, exitCode: number): void {
  bus.emit(exitCode !== 0 ? 'process.crashed' : 'process.stopped', {
    runId, pid, exitCode, ts: Date.now(),
  });
}
