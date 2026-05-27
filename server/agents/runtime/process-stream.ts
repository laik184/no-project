/**
 * process-stream.ts
 * Streaming process wrapper — emits real-time chunks via callbacks.
 * Replaces the buffer-only approach in shell-executor.ts.
 */

import { spawn }        from 'child_process';
import { StreamBuffer } from './stream-buffer.ts';
import { validateCommand }  from './command-validator.ts';

export interface StreamOptions {
  cwd:         string;
  timeoutMs?:  number;
  onStdout?:   (chunk: string) => void;
  onStderr?:   (chunk: string) => void;
  env?:        NodeJS.ProcessEnv;
}

export interface StreamResult {
  stdout:    string;
  stderr:    string;
  exitCode:  number;
  durationMs:number;
  truncated: boolean;
}

/**
 * Run a command and stream its output.
 * Full output is captured in StreamBuffers; callbacks receive real-time chunks.
 */
export async function runStreaming(
  command:  string,
  opts:     StreamOptions,
): Promise<StreamResult> {
  const validated  = validateCommand(command);
  const timeoutMs  = opts.timeoutMs ?? 60_000;
  const start      = Date.now();

  const stdoutBuf  = new StreamBuffer({ onChunk: opts.onStdout });
  const stderrBuf  = new StreamBuffer({ onChunk: opts.onStderr });

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
      reject(new Error(`Process timed out after ${timeoutMs}ms: ${command}`));
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
      reject(new Error(`Spawn error: ${err.message}`));
    });
  });
}
