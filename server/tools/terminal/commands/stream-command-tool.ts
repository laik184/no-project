/**
 * server/tools/terminal/commands/stream-command-tool.ts
 * Tool: terminal_stream_command
 *
 * Spawns a shell command and collects output until completion or timeout.
 * Returns collected stdout/stderr and exit code.
 */

import { spawn }    from 'child_process';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertCommand }                             from '../validation/command-validator.ts';
import { resolveCwd }                                from '../validation/sandbox-validator.ts';

export const streamCommandTool: ToolDefinition = {
  name:        'terminal_stream_command',
  category:    'terminal',
  description: 'Spawn a shell command and collect its output, returning all lines on completion.',
  inputSchema: {
    command:   { type: 'string', description: 'Shell command to run',                       required: true  },
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root',  required: false },
    timeoutMs: { type: 'number', description: 'Max wait time in ms (default 60 000)',        required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.DEFAULT * 2,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const command   = assertCommand(input.command);
    const cwd       = resolveCwd(ctx.sandboxRoot, input.cwd as string | undefined);
    const timeoutMs = Number(input.timeoutMs ?? 60_000);
    const start     = Date.now();

    return new Promise<object>((resolve) => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      let   timedOut              = false;

      const proc = spawn('sh', ['-c', command], {
        cwd,
        env:   { ...process.env, ...(input.env as Record<string, string> ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
      }, timeoutMs);

      proc.stdout.on('data', (chunk: Buffer) => stdoutLines.push(chunk.toString()));
      proc.stderr.on('data', (chunk: Buffer) => stderrLines.push(chunk.toString()));

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          pid:        proc.pid ?? 0,
          exitCode:   code ?? 1,
          stdout:     stdoutLines.join(''),
          stderr:     stderrLines.join(''),
          timedOut,
          durationMs: Date.now() - start,
        });
      });
    });
  },
};
