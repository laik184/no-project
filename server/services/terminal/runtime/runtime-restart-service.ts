/**
 * server/services/terminal/runtime/runtime-restart-service.ts
 *
 * Handles graceful stop → delay → start restart sequences for runtimes.
 */

import { processService } from '../process/process-service.ts';
import type { ManagedProcess } from '../process/process-lifecycle-service.ts';

export class RestartError extends Error {
  constructor(message: string) {
    super(`[runtime-restart] ${message}`);
    this.name = 'RestartError';
  }
}

export interface RestartOptions {
  gracePeriodMs?: number;
  force?:         boolean;
  command?:       string;
  env?:           Record<string, string>;
}

export interface RestartResult {
  sessionId:   string;
  pid:         number;
  restartedAt: number;
}

export const runtimeRestartService = {
  async restart(sessionId: string, cwd: string, opts: RestartOptions = {}): Promise<RestartResult> {
    const gracePeriod = opts.gracePeriodMs ?? 500;

    processService.stop(sessionId, opts.force ?? false);

    if (gracePeriod > 0) {
      await new Promise(r => setTimeout(r, gracePeriod));
    }

    const managed: ManagedProcess = processService.start(
      sessionId,
      opts.command ?? '',
      cwd,
      opts.env ?? {},
    );

    return { sessionId, pid: managed.pid, restartedAt: Date.now() };
  },
};
