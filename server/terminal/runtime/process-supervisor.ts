/**
 * server/terminal/runtime/process-supervisor.ts
 *
 * Spawns and supervises child processes with configurable restart policy.
 */

import { spawn }    from 'child_process';
import type { ChildProcess } from 'child_process';
import { makeProcessStarted, makeProcessCrashed, makeProcessStopped } from '../events/process-events.ts';

export class SupervisorError extends Error {
  constructor(message: string) {
    super(`[process-supervisor] ${message}`);
    this.name = 'SupervisorError';
  }
}

export interface SupervisorOptions {
  maxRestarts?:   number;
  restartDelayMs?: number;
  onStart?:       (payload: ReturnType<typeof makeProcessStarted>) => void;
  onStop?:        (payload: ReturnType<typeof makeProcessStopped>) => void;
  onCrash?:       (payload: ReturnType<typeof makeProcessCrashed>) => void;
  onLine?:        (line: string, source: 'stdout' | 'stderr') => void;
}

export interface SupervisorHandle {
  pid:       number;
  sessionId: string;
  kill(force?: boolean): void;
  isAlive(): boolean;
}

export function spawnSupervised(
  sessionId: string,
  command:   string,
  args:      string[],
  cwd:       string,
  env:       Record<string, string>,
  opts:      SupervisorOptions = {},
): SupervisorHandle {
  const maxRestarts   = opts.maxRestarts   ?? 0;
  const restartDelay  = opts.restartDelayMs ?? 1000;
  let   restarts      = 0;
  let   proc: ChildProcess;
  let   killed        = false;

  function attach(p: ChildProcess): void {
    p.stdout?.on('data', (c: Buffer) =>
      c.toString().split('\n').filter(Boolean).forEach(l => opts.onLine?.(l, 'stdout')));
    p.stderr?.on('data', (c: Buffer) =>
      c.toString().split('\n').filter(Boolean).forEach(l => opts.onLine?.(l, 'stderr')));

    p.on('close', (code, signal) => {
      if (killed) {
        opts.onStop?.(makeProcessStopped(sessionId, p.pid ?? 0, code, signal));
        return;
      }
      if (restarts < maxRestarts) {
        restarts++;
        opts.onCrash?.(makeProcessCrashed(sessionId, p.pid ?? 0, code, signal, restarts));
        setTimeout(() => {
          if (!killed) {
            proc = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
            opts.onStart?.(makeProcessStarted(sessionId, proc.pid ?? 0, [command, ...args].join(' '), cwd));
            attach(proc);
          }
        }, restartDelay);
      } else {
        opts.onCrash?.(makeProcessCrashed(sessionId, p.pid ?? 0, code, signal, restarts));
      }
    });
  }

  proc = spawn(command, args, {
    cwd,
    env:   { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  opts.onStart?.(makeProcessStarted(sessionId, proc.pid ?? 0, [command, ...args].join(' '), cwd));
  attach(proc);

  return {
    get pid() { return proc.pid ?? 0; },
    sessionId,
    kill(force = false) {
      killed = true;
      try { proc.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch { /* gone */ }
    },
    isAlive() {
      try { process.kill(proc.pid ?? 0, 0); return true; } catch { return false; }
    },
  };
}
