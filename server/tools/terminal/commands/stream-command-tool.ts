/**
 * server/tools/terminal/commands/stream-command-tool.ts
 * Tool: terminal_stream_command
 *
 * Spawns a shell command via CommandService and collects output until completion.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { commandService }                            from '../../../services/terminal/index.ts';

export const streamCommandTool: ToolDefinition = {
  name:        'terminal_stream_command',
  category:    'terminal',
  description: 'Spawn a shell command and collect its output, returning all lines on completion.',
  inputSchema: {
    command:   { type: 'string', description: 'Shell command to run',                      required: true  },
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root', required: false },
    timeoutMs: { type: 'number', description: 'Max wait time in ms (default 60 000)',       required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.DEFAULT * 2,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return commandService.stream(String(input.command), {
      cwd:         input.cwd      as string | undefined,
      env:         input.env      as Record<string, string> | undefined,
      timeoutMs:   input.timeoutMs ? Number(input.timeoutMs) : 60_000,
      sandboxRoot: ctx.sandboxRoot,
    });
  },
};
