/**
 * server/tools/terminal/commands/execute-command-tool.ts
 * Tool: terminal_execute_command
 *
 * Runs a shell command synchronously via CommandService and returns stdout/stderr.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { commandService }                            from '../../../services/terminal/index.ts';

export const executeCommandTool: ToolDefinition = {
  name:        'terminal_execute_command',
  category:    'terminal',
  description: 'Execute a shell command in the sandbox and return stdout, stderr, and exit code.',
  inputSchema: {
    command:   { type: 'string', description: 'Shell command to run',                      required: true  },
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root', required: false },
    timeoutMs: { type: 'number', description: 'Max execution time in ms (default 30 000)',  required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return commandService.execute(String(input.command), {
      cwd:         input.cwd      as string | undefined,
      env:         input.env      as Record<string, string> | undefined,
      timeoutMs:   input.timeoutMs ? Number(input.timeoutMs) : undefined,
      sandboxRoot: ctx.sandboxRoot,
    });
  },
};
