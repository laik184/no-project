/**
 * server/tools/terminal/runtime/stop-runtime-tool.ts
 * Tool: terminal_stop_runtime
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { getProcess, deleteProcess, isRunning }      from './process-store.ts';

export const stopRuntimeTool: ToolDefinition = {
  name:        'terminal_stop_runtime',
  category:    'terminal',
  description: 'Stop the running runtime process for a project.',
  inputSchema: {
    projectId: { type: 'number',  description: 'Project identifier',     required: true  },
    force:     { type: 'boolean', description: 'Use SIGKILL (immediate)', required: false },
  },
  permissions: ['execute', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const projectId = Number(input.projectId);
    const force     = Boolean(input.force);

    if (!isRunning(projectId)) {
      return { projectId, stopped: false, message: 'No running process found.' };
    }

    const rec = getProcess(projectId)!;
    try {
      rec.process.kill(force ? 'SIGKILL' : 'SIGTERM');
    } catch { /* already gone */ }
    deleteProcess(projectId);

    return { projectId, pid: rec.pid, stopped: true };
  },
};
