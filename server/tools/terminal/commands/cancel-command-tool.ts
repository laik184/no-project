/**
 * server/tools/terminal/commands/cancel-command-tool.ts
 * Tool: terminal_cancel_command
 *
 * Cancels a running command by PID via CommandService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { commandService }                            from '../../../services/terminal/index.ts';

export const cancelCommandTool: ToolDefinition = {
  name:        'terminal_cancel_command',
  category:    'terminal',
  description: 'Cancel a running command by sending SIGTERM (or SIGKILL) to the given PID.',
  inputSchema: {
    pid:   { type: 'number',  description: 'Process ID to terminate',              required: true  },
    force: { type: 'boolean', description: 'Use SIGKILL instead of SIGTERM',       required: false },
  },
  permissions: ['execute', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const pid   = Number(input.pid);
    const force = Boolean(input.force);

    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error('pid must be a positive integer.');
    }

    return commandService.cancel(pid, force);
  },
};
