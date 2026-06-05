/**
 * server/services/terminal/runtime/runtime-service.ts
 *
 * Main runtime manager — start, stop, restart, status for project runtimes.
 */

import { processService }        from '../process/process-service.ts';
import { runtimeHealthService }  from './runtime-health-service.ts';
import { runtimeRestartService } from './runtime-restart-service.ts';
import type { LineHandler }      from '../process/process-stream-service.ts';
import type { RestartOptions }   from './runtime-restart-service.ts';

export class RuntimeError extends Error {
  constructor(message: string) {
    super(`[runtime-service] ${message}`);
    this.name = 'RuntimeError';
  }
}

export interface RuntimeInfo {
  sessionId: string;
  pid:       number;
  command:   string;
  cwd:       string;
  startedAt: number;
  running:   boolean;
  uptimeMs:  number;
}

export const runtimeService = {
  start(
    sessionId: string,
    command:   string,
    cwd:       string,
    env:       Record<string, string> = {},
    onLine?:   LineHandler,
  ): RuntimeInfo {
    const managed = processService.start(sessionId, command, cwd, env, onLine);
    return {
      sessionId,
      pid:       managed.pid,
      command:   managed.command,
      cwd:       managed.cwd,
      startedAt: managed.startedAt,
      running:   true,
      uptimeMs:  0,
    };
  },

  stop(sessionId: string, force = false): boolean {
    return processService.stop(sessionId, force);
  },

  async restart(sessionId: string, cwd: string, opts: RestartOptions = {}): Promise<RuntimeInfo> {
    const result = await runtimeRestartService.restart(sessionId, cwd, opts);
    const status = processService.status(sessionId);
    return {
      sessionId,
      pid:       result.pid,
      command:   opts.command ?? status?.command ?? '',
      cwd,
      startedAt: result.restartedAt,
      running:   true,
      uptimeMs:  0,
    };
  },

  status(sessionId: string): RuntimeInfo | null {
    const s = processService.status(sessionId);
    if (!s) return null;
    const health = runtimeHealthService.check(sessionId, s.pid);
    return {
      sessionId: s.sessionId,
      pid:       s.pid,
      command:   s.command,
      cwd:       s.cwd,
      startedAt: s.startedAt,
      running:   health.alive,
      uptimeMs:  s.uptimeMs,
    };
  },

  listAll(): RuntimeInfo[] {
    return processService.list().map(s => {
      const health = runtimeHealthService.check(s.sessionId, s.pid);
      return {
        sessionId: s.sessionId,
        pid:       s.pid,
        command:   s.command,
        cwd:       s.cwd,
        startedAt: s.startedAt,
        running:   health.alive,
        uptimeMs:  s.uptimeMs,
      };
    });
  },
};
