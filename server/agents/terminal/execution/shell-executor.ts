import { validateCommand }   from '../security/command-validator.ts';
import { spawnProcess }      from './process-spawner.ts';
import { StreamBuffer }      from '../streaming/stream-buffer.ts';
import { registerTimeout, cancelTimeout } from './execution-timeout.ts';
import type { ExecutionResult }  from '../types/execution.types.ts';

export async function shellExecute(
  command:   string,
  cwd:       string,
  timeoutMs  = 30_000,
  env?:      NodeJS.ProcessEnv,
): Promise<ExecutionResult> {
  const validated  = validateCommand(command);
  const start      = Date.now();
  const stdoutBuf  = new StreamBuffer();
  const stderrBuf  = new StreamBuffer();

  return new Promise<ExecutionResult>((resolve, reject) => {
    const { process: proc } = spawnProcess(validated, { cwd, env });

    proc.stdout!.on('data', (d: Buffer) => stdoutBuf.push(d));
    proc.stderr!.on('data', (d: Buffer) => stderrBuf.push(d));

    const timeoutId = `shell_${start}`;
    registerTimeout(timeoutId, timeoutMs, () => {
      proc.kill('SIGTERM');
      reject(new Error(`[shell-executor] Timed out after ${timeoutMs}ms: ${command}`));
    });

    proc.on('close', (code) => {
      cancelTimeout(timeoutId);
      const exitCode = code ?? 1;
      resolve({
        command,
        stdout:     stdoutBuf.text,
        stderr:     stderrBuf.text,
        exitCode,
        durationMs: Date.now() - start,
        success:    exitCode === 0,
      });
    });

    proc.on('error', (err) => {
      cancelTimeout(timeoutId);
      reject(new Error(`[shell-executor] Spawn error: ${err.message}`));
    });
  });
}
