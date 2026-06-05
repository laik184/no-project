/**
 * server/tools/terminal/process/kill-process-tool.ts
 * Tool: terminal_kill_process
 *
 * Kills a process by PID and removes it from the process store if tracked.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { listProcesses, deleteProcess }              from '../runtime/process-store.ts';

export const killProcessTool: ToolDefinition = {
  name:        'terminal_kill_process',
  category:    'terminal',
  description: 'Kill a process by PID. Also removes it from the process store if it was tracked.',
  inputSchema: {
    pid:   { type: 'number',  description: 'Process ID to kill',         required: true  },
    force: { type: 'boolean', description: 'Use SIGKILL instead of SIGTERM', required: false },
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

    const tracked = listProcesses().find(r => r.pid === pid);

    try {
      process.kill(pid, signal);
      if (tracked) deleteProcess(tracked.projectId);
      return { killed: true, pid, signal, wasTracked: !!tracked };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') {
        if (tracked) deleteProcess(tracked.projectId);
        return { killed: false, pid, signal, wasTracked: !!tracked, error: 'Process already exited.' };
      }
      throw err;
    }
  },
};
