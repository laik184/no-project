import type { ChildProcess } from 'child_process';
import { killProcess }       from '../utils/process-utils.ts';

const SIGKILL_DELAY_MS = 3_000;

export async function terminateProcess(
  proc:      ChildProcess,
  pid:       number,
  graceful   = true,
): Promise<void> {
  if (graceful) {
    killProcess(pid, 'SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        killProcess(pid, 'SIGKILL');
        resolve();
      }, SIGKILL_DELAY_MS);

      proc.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } else {
    killProcess(pid, 'SIGKILL');
  }
}

export function forceKill(pid: number): void {
  killProcess(pid, 'SIGKILL');
}
