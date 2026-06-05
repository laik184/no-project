/**
 * server/services/terminal/process/process-service.ts
 *
 * High-level facade combining lifecycle and stream management.
 */

import { processLifecycleService } from './process-lifecycle-service.ts';
import { processStreamService }    from './process-stream-service.ts';
import type { LineHandler }        from './process-stream-service.ts';
import type { ManagedProcess }     from './process-lifecycle-service.ts';

export class ProcessServiceError extends Error {
  constructor(message: string) {
    super(`[process-service] ${message}`);
    this.name = 'ProcessServiceError';
  }
}

export interface ProcessStatus {
  sessionId: string;
  pid:       number;
  command:   string;
  cwd:       string;
  startedAt: number;
  running:   boolean;
  uptimeMs:  number;
}

export const processService = {
  start(
    sessionId:  string,
    command:    string,
    cwd:        string,
    env:        Record<string, string> = {},
    onLine?:    LineHandler,
  ): ManagedProcess {
    const managed = processLifecycleService.start(sessionId, command, cwd, env);
    processStreamService.attach(sessionId, managed.proc);
    if (onLine) processStreamService.subscribe(sessionId, onLine);
    return managed;
  },

  stop(sessionId: string, force = false): boolean {
    processStreamService.detach(sessionId);
    return processLifecycleService.stop(sessionId, force);
  },

  restart(sessionId: string, command?: string, env: Record<string, string> = {}): ManagedProcess {
    processStreamService.detach(sessionId);
    return processLifecycleService.restart(sessionId, command, env);
  },

  status(sessionId: string): ProcessStatus | null {
    const m = processLifecycleService.get(sessionId);
    if (!m) return null;
    return {
      sessionId: m.sessionId,
      pid:       m.pid,
      command:   m.command,
      cwd:       m.cwd,
      startedAt: m.startedAt,
      running:   processLifecycleService.isRunning(sessionId),
      uptimeMs:  Date.now() - m.startedAt,
    };
  },

  list(): ProcessStatus[] {
    return processLifecycleService.list().map(m => ({
      sessionId: m.sessionId,
      pid:       m.pid,
      command:   m.command,
      cwd:       m.cwd,
      startedAt: m.startedAt,
      running:   processLifecycleService.isRunning(m.sessionId),
      uptimeMs:  Date.now() - m.startedAt,
    }));
  },

  subscribe(sessionId: string, handler: LineHandler): string {
    return processStreamService.subscribe(sessionId, handler);
  },

  unsubscribe(sessionId: string, subId: string): boolean {
    return processStreamService.unsubscribe(sessionId, subId);
  },
};
