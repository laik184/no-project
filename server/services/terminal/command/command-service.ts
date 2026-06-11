/**
 * server/services/terminal/command/command-service.ts
 *
 * Core command execution service.
 * Owns: synchronous execute, async stream, and PID-based cancel.
 */

import { spawnSync, spawn }  from 'child_process';
import { existsSync, statSync } from 'fs';
import { isAbsolute, resolve }  from 'path';
import { commandValidator }     from './command-validator.ts';

export class CommandError extends Error {
  public readonly code?: string;

  constructor(message: string, code?: string) {
    super(`[command-service] ${message}`);
    this.name = 'CommandError';
    this.code = code;
  }
}

export interface ExecuteOptions {
  cwd?:       string;
  env?:       Record<string, string>;
  timeoutMs?: number;
  sandboxRoot: string;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
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

function resolveSandboxCwd(sandboxRoot: string, cwd?: string): string {
  const root = resolve(sandboxRoot);
  const candidate = cwd
    ? isAbsolute(cwd)
      ? resolve(cwd)
      : resolve(root, cwd)
    : root;

  if (candidate !== root && !candidate.startsWith(`${root}/`)) {
    throw new CommandError(`cwd escapes sandbox: ${cwd}`);
  }
  if (!existsSync(candidate)) {
    throw new CommandError(`cwd does not exist: ${candidate}`);
  }
  if (!statSync(candidate).isDirectory()) {
    throw new CommandError(`cwd is not a directory: ${candidate}`);
  }
  return candidate;
}

export const commandService = {
  execute(command: string, opts: ExecuteOptions): ExecuteResult {
    commandValidator.assert(command);
    const cwd     = resolveSandboxCwd(opts.sandboxRoot, opts.cwd);
    const timeout = opts.timeoutMs ?? 30_000;
    const start   = Date.now();

    // Use shell: true so builtins, pipes, and redirects work.
    // Pass the raw command string directly to the shell.
    const result = spawnSync(command, [], {
      cwd,
      env:       { ...process.env, ...(opts.env ?? {}) },
      encoding:  'utf8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      shell:     true,
    });

    return {
      exitCode:   result.status ?? 1,
      stdout:     result.stdout ?? '',
      stderr:     result.stderr ?? (result.error ? result.error.message : ''),
      timedOut:   result.signal === 'SIGTERM',
      durationMs: Date.now() - start,
    };
  },

  stream(command: string, opts: ExecuteOptions): Promise<StreamResult> {
    commandValidator.assert(command);
    const cwd     = resolveSandboxCwd(opts.sandboxRoot, opts.cwd);
    const timeout = opts.timeoutMs ?? 60_000;

    return new Promise<StreamResult>((resolve, reject) => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let   timedOut               = false;
      let   settled                = false;
      const start                  = Date.now();

      // Use shell: true so pipes, redirects, and builtins work correctly.
      // Pass the raw command string directly to the shell.
      const proc = spawn(command, [], {
        cwd,
        env:   { ...process.env, ...(opts.env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try { proc.kill('SIGTERM'); } catch { /* gone */ }
      }, timeout);

      proc.stdout?.on('data', (c: Buffer) => {
        const text = c.toString();
        stdoutChunks.push(text);
        opts.onStdout?.(text);
      });
      proc.stderr?.on('data', (c: Buffer) => {
        const text = c.toString();
        stderrChunks.push(text);
        opts.onStderr?.(text);
      });

      proc.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new CommandError(`Spawn failed: ${err.message}`, (err as NodeJS.ErrnoException).code));
      });

      proc.on('close', (code) => {
        if (settled) return;
        settled = true;
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
