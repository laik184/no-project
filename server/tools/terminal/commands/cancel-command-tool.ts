/**
 * server/tools/terminal/commands/cancel-command-tool.ts
 * Tool: terminal_cancel_command
 *
 * Sends SIGTERM to a running process by PID.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';

export const cancelCommandTool: ToolDefinition = {
  name:        'terminal_cancel_command',
  category:    'terminal',
  description: 'Cancel a running command by sending SIGTERM to the given PID.',
  inputSchema: {
    pid:    { type: 'number', description: 'Process ID to terminate',                  required: true  },
    force:  { type: 'boolean', description: 'Use SIGKILL instead of SIGTERM',          required: false },
  },
  permissions: ['execute', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const pid    = Number(input.pid);
    const signal = input.force ? 'SIGKILL' : 'SIGTERM';

    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error('pid must be a positive integer.');
    }

    try {
      process.kill(pid, signal);
      return { killed: true, pid, signal };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') {
        return { killed: false, pid, signal, error: 'Process not found (already exited).' };
      }
      throw err;
    }
  },
};
