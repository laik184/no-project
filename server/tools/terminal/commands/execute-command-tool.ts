/**
 * server/tools/terminal/commands/execute-command-tool.ts
 * Tool: terminal_execute_command
 *
 * Runs a shell command synchronously in the sandbox and returns stdout/stderr.
 */

import { spawnSync }   from 'child_process';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { assertCommand }                             from '../validation/command-validator.ts';
import { resolveCwd }                                from '../validation/sandbox-validator.ts';

export const executeCommandTool: ToolDefinition = {
  name:        'terminal_execute_command',
  category:    'terminal',
  description: 'Execute a shell command in the sandbox and return stdout, stderr, and exit code.',
  inputSchema: {
    command:   { type: 'string',  description: 'Shell command to run',                      required: true  },
    cwd:       { type: 'string',  description: 'Working directory relative to sandbox root', required: false },
    timeoutMs: { type: 'number',  description: 'Max execution time in ms (default 30 000)',  required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const command   = assertCommand(input.command);
    const cwd       = resolveCwd(ctx.sandboxRoot, input.cwd as string | undefined);
    const timeoutMs = Number(input.timeoutMs ?? 30_000);
    const start     = Date.now();

    const result = spawnSync('sh', ['-c', command], {
      cwd,
      env:       { ...process.env, ...(input.env as Record<string, string> ?? {}) },
      encoding:  'utf8',
      timeout:   timeoutMs,
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
};
