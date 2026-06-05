/**
 * server/tools/terminal/process/kill-process-tool.ts
 * Tool: terminal_kill_process
 *
 * Kills a process by PID. Cleans up via ProcessService if the PID is tracked.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { processService }                            from '../../../services/terminal/index.ts';

export const killProcessTool: ToolDefinition = {
  name:        'terminal_kill_process',
  category:    'terminal',
  description: 'Kill a process by PID. Also cleans up the tracked session if one matches.',
  inputSchema: {
    pid:   { type: 'number',  description: 'Process ID to kill',              required: true  },
    force: { type: 'boolean', description: 'Use SIGKILL instead of SIGTERM',  required: false },
  },
  permissions: ['execute', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const pid    = Number(input.pid);
    const force  = Boolean(input.force);
    const signal = force ? 'SIGKILL' : 'SIGTERM';

    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error('pid must be a positive integer.');
    }

    // Find whether this PID belongs to a tracked session
    const tracked = processService.list().find(p => p.pid === pid);

    try {
      process.kill(pid, signal);

      // Detach from process service if tracked
      if (tracked) processService.stop(tracked.sessionId, force);

      return { killed: true, pid, signal, sessionId: tracked?.sessionId ?? null };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') {
        if (tracked) processService.stop(tracked.sessionId, false);
        return { killed: false, pid, signal, sessionId: tracked?.sessionId ?? null, error: 'Process already exited.' };
      }
      throw err;
    }
  },
};
