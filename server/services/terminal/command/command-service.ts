/**
 * server/services/terminal/command/command-service.ts
 *
 * Core command execution service.
 * Owns: synchronous execute, async stream, and PID-based cancel.
 */

import { spawnSync, spawn }  from 'child_process';
import { join }              from 'path';
import { commandParser }     from './command-parser.ts';
import { commandValidator }  from './command-validator.ts';

export class CommandError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(`[command-service] ${message}`);
    this.name = 'CommandError';
  }
}

export interface ExecuteOptions {
  cwd?:       string;
  env?:       Record<string, string>;
  timeoutMs?: number;
  sandboxRoot: string;
}

export interface ExecuteResult {
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  timedOut:   boolean;
  durationMs: number;
}

export interface StreamResult {
  pid:        number;
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  timedOut:   boolean;
  durationMs: number;
}

export const commandService = {
  execute(command: string, opts: ExecuteOptions): ExecuteResult {
    commandValidator.assert(command);
    const parsed  = commandParser.parse(command);
    const cwd     = opts.cwd ? join(opts.sandboxRoot, opts.cwd) : opts.sandboxRoot;
    const timeout = opts.timeoutMs ?? 30_000;
    const start   = Date.now();

    const result = spawnSync(parsed.executable, parsed.args, {
      cwd,
      env:       { ...process.env, ...parsed.env, ...(opts.env ?? {}) },
      encoding:  'utf8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      exitCode:   result.status ?? 1,
      stdout:     result.stdout ?? '',
      stderr:     result.stderr ?? '',
      timedOut:   result.signal === 'SIGTERM',
      durationMs: Date.now() - start,
    };
  },

  stream(command: string, opts: ExecuteOptions): Promise<StreamResult> {
    commandValidator.assert(command);
    const parsed  = commandParser.parse(command);
    const cwd     = opts.cwd ? join(opts.sandboxRoot, opts.cwd) : opts.sandboxRoot;
    const timeout = opts.timeoutMs ?? 60_000;

    return new Promise<StreamResult>((resolve) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let   timedOut               = false;
      const start                  = Date.now();

      const proc = spawn(parsed.executable, parsed.args, {
        cwd,
        env:   { ...process.env, ...parsed.env, ...(opts.env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
      }, timeout);

      proc.stdout.on('data', (c: Buffer) => stdoutChunks.push(c.toString()));
      proc.stderr.on('data', (c: Buffer) => stderrChunks.push(c.toString()));

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          pid:        proc.pid ?? 0,
          exitCode:   code ?? 1,
          stdout:     stdoutChunks.join(''),
          stderr:     stderrChunks.join(''),
          timedOut,
          durationMs: Date.now() - start,
        });
      });
    });
  },

  cancel(pid: number, force = false): { killed: boolean; pid: number } {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    try {
      process.kill(pid, signal);
      return { killed: true, pid };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') return { killed: false, pid };
      throw new CommandError(`Failed to kill pid ${pid}: ${String(err)}`, code);
    }
  },
};
