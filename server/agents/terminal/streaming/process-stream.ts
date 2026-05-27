import { spawn }           from 'child_process';
import { StreamBuffer }    from './stream-buffer.ts';
import { sanitizeChunk }   from './stream-sanitizer.ts';
import { validateCommand } from '../security/command-validator.ts';
import type { StreamOptions, StreamResult } from '../types/stream.types.ts';

export async function runStreaming(
  command: string,
  opts:    StreamOptions,
): Promise<StreamResult> {
  const validated  = validateCommand(command);
  const timeoutMs  = opts.timeoutMs ?? 60_000;
  const start      = Date.now();

  const stdoutBuf = new StreamBuffer({ onChunk: (c) => opts.onStdout?.(sanitizeChunk(c)) });
  const stderrBuf = new StreamBuffer({ onChunk: (c) => opts.onStderr?.(sanitizeChunk(c)) });

  return new Promise<StreamResult>((resolve, reject) => {
    const proc = spawn(validated.executable, validated.args, {
      cwd:   opts.cwd,
      env:   opts.env ?? process.env,
      shell: false,
    });

    proc.stdout.on('data', (d: Buffer) => stdoutBuf.push(d));
    proc.stderr.on('data', (d: Buffer) => stderrBuf.push(d));

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`[process-stream] Timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout:     stdoutBuf.text,
        stderr:     stderrBuf.text,
        exitCode:   code ?? 1,
        durationMs: Date.now() - start,
        truncated:  stdoutBuf.isCapped || stderrBuf.isCapped,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`[process-stream] Spawn error: ${err.message}`));
    });
  });
}
