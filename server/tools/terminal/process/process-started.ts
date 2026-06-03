import { bus } from '../../../infrastructure/index.ts';

export function emitProcessStarted(runId: string, pid: number, command: string, port?: number): void {
  bus.emit('process.started', { runId, pid, command, port, ts: Date.now() });
}
