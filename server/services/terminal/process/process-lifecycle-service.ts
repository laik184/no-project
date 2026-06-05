/**
 * server/services/terminal/process/process-lifecycle-service.ts
 *
 * Low-level process start / stop / restart primitives.
 * Maintains an in-process Map of running ChildProcesses keyed by sessionId.
 */

import { spawn }    from 'child_process';
import type { ChildProcess } from 'child_process';
import { commandParser }     from '../command/command-parser.ts';
import { commandValidator }  from '../command/command-validator.ts';

export class LifecycleError extends Error {
  constructor(message: string) {
    super(`[process-lifecycle] ${message}`);
    this.name = 'LifecycleError';
  }
}

export interface ManagedProcess {
  sessionId: string;
  pid:       number;
  command:   string;
  cwd:       string;
  startedAt: number;
  proc:      ChildProcess;
}

const _registry = new Map<string, ManagedProcess>();

export const processLifecycleService = {
  start(
    sessionId: string,
    command:   string,
    cwd:       string,
    env:       Record<string, string> = {},
  ): ManagedProcess {
    commandValidator.assert(command);

    if (_registry.has(sessionId)) {
      throw new LifecycleError(`Session "${sessionId}" already has a running process.`);
    }

    const parsed = commandParser.parse(command);
    const proc   = spawn(parsed.executable, parsed.args, {
      cwd,
      env:   { ...process.env, ...parsed.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const managed: ManagedProcess = {
      sessionId,
      pid:       proc.pid ?? 0,
      command,
      cwd,
      startedAt: Date.now(),
      proc,
    };

    _registry.set(sessionId, managed);

    proc.on('close', () => { _registry.delete(sessionId); });

    return managed;
  },

  stop(sessionId: string, force = false): boolean {
    const managed = _registry.get(sessionId);
    if (!managed) return false;

    try { managed.proc.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch { /* already gone */ }
    _registry.delete(sessionId);
    return true;
  },

  restart(sessionId: string, command?: string, env: Record<string, string> = {}): ManagedProcess {
    const existing = _registry.get(sessionId);
    const cmd      = command ?? existing?.command;
    const cwd      = existing?.cwd ?? process.cwd();

    if (!cmd) throw new LifecycleError(`No command to restart for session "${sessionId}".`);

    this.stop(sessionId, false);

    return this.start(sessionId, cmd, cwd, env);
  },

  get(sessionId: string): ManagedProcess | undefined {
    return _registry.get(sessionId);
  },

  list(): ManagedProcess[] {
    return [..._registry.values()];
  },

  isRunning(sessionId: string): boolean {
    const m = _registry.get(sessionId);
    if (!m) return false;
    try { process.kill(m.pid, 0); return true; } catch { return false; }
  },
};
