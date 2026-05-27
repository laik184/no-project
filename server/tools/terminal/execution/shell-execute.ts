/**
 * server/tools/terminal/execution/shell-execute.ts
 *
 * Fix #13 — Production-grade shell argument parsing.
 * Replaced naive `command.split(/\s+/)` with `parseShellArgs()`.
 * Quoted arguments and paths with spaces are now handled correctly.
 */

import { spawnProcess }           from './spawn-process.ts';
import { registerTimeout, cancelTimeout } from './timeout-manager.ts';
import { validateCommand }        from '../validation/command-validator.ts';
import { clampTimeout }           from '../security/resource-limits.ts';
import { parseShellArgs }         from './parse-shell-args.ts';
import type { ExecutionResult }   from '../shared/terminal-types.ts';

export async function shellExecute(
  command:   string,
  cwd:       string,
  timeoutMs  = 30_000,
  env?:      Record<string, string>,
): Promise<ExecutionResult> {
  validateCommand(command);
  const safeTimeout = clampTimeout(timeoutMs);
  const start       = Date.now();
  let stdout  = '';
  let stderr  = '';
  let timedOut = false;

  return new Promise<ExecutionResult>((resolve, reject) => {
    // Fix #13: production-grade parsing — preserves quoted args and escaped spaces
    const parts = parseShellArgs(command);
    if (parts.length === 0) {
      reject(new Error('[shell-execute] Empty command'));
      return;
    }
    const exe  = parts[0];
    const args = parts.slice(1);

    const { process: proc } = spawnProcess(exe, args, { cwd, env });

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    const key = `shell_${start}`;
    registerTimeout(key, safeTimeout, () => {
      timedOut = true;
      proc.kill('SIGTERM');
    });

    proc.on('close', (code) => {
      cancelTimeout(key);
      const exitCode = code ?? 1;
      resolve({
        command,
        stdout,
        stderr,
        exitCode,
        durationMs: Date.now() - start,
        success:    exitCode === 0,
        timedOut,
      });
    });

    proc.on('error', (err) => {
      cancelTimeout(key);
      reject(new Error(`[shell-execute] Spawn error: ${err.message}`));
    });
  });
}
