/**
 * server/terminal/runtime/terminal-lifecycle.ts
 *
 * Orchestrates start / stop / restart of supervised processes
 * tied to terminal sessions. Coordinates session-manager + supervisor.
 */

import { spawnSupervised }       from './process-supervisor.ts';
import { terminalSessionManager } from './terminal-session-manager.ts';
import type { SupervisorHandle } from './process-supervisor.ts';

export class LifecycleError extends Error {
  constructor(message: string) {
    super(`[terminal-lifecycle] ${message}`);
    this.name = 'LifecycleError';
  }
}

export interface LifecycleStartOptions {
  maxRestarts?:    number;
  restartDelayMs?: number;
  onLine?:         (line: string, source: 'stdout' | 'stderr') => void;
  onCrash?:        () => void;
  onStop?:         () => void;
}

const _handles = new Map<string, SupervisorHandle>();

export const terminalLifecycle = {
  start(
    sessionId: string,
    command:   string,
    opts:      LifecycleStartOptions = {},
  ): SupervisorHandle {
    if (_handles.has(sessionId)) {
      throw new LifecycleError(`Session "${sessionId}" already has a running process.`);
    }

    const session = terminalSessionManager.require(sessionId);
    const [cmd, ...args] = command.trim().split(/\s+/);

    const handle = spawnSupervised(sessionId, cmd, args, session.cwd, session.env, {
      maxRestarts:    opts.maxRestarts    ?? 0,
      restartDelayMs: opts.restartDelayMs ?? 1000,
      onLine:         opts.onLine,
      onStop:         () => {
        _handles.delete(sessionId);
        terminalSessionManager.markIdle(sessionId);
        opts.onStop?.();
      },
      onCrash: () => {
        opts.onCrash?.();
      },
    });

    _handles.set(sessionId, handle);
    terminalSessionManager.markRunning(sessionId);
    return handle;
  },

  stop(sessionId: string, force = false): boolean {
    const handle = _handles.get(sessionId);
    if (!handle) return false;
    handle.kill(force);
    _handles.delete(sessionId);
    terminalSessionManager.markIdle(sessionId);
    return true;
  },

  async restart(sessionId: string, command: string, opts: LifecycleStartOptions = {}): Promise<SupervisorHandle> {
    this.stop(sessionId, false);
    await new Promise(r => setTimeout(r, 300));
    return this.start(sessionId, command, opts);
  },

  getHandle(sessionId: string): SupervisorHandle | undefined {
    return _handles.get(sessionId);
  },

  isRunning(sessionId: string): boolean {
    return _handles.get(sessionId)?.isAlive() ?? false;
  },

  listRunning(): string[] {
    return [..._handles.keys()].filter(id => _handles.get(id)!.isAlive());
  },
};
