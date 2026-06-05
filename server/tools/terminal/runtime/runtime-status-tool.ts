/**
 * server/tools/terminal/runtime/runtime-status-tool.ts
 * Tool: terminal_runtime_status
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { getProcess, isRunning }                     from './process-store.ts';

export const runtimeStatusTool: ToolDefinition = {
  name:        'terminal_runtime_status',
  category:    'terminal',
  description: 'Get the current status of the runtime process for a project.',
  inputSchema: {
    projectId: { type: 'number', description: 'Project identifier', required: true },
  },
  permissions: ['read', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const projectId = Number(input.projectId);
    const running   = isRunning(projectId);
    const rec       = getProcess(projectId);

    return {
      projectId,
      running,
      pid:       rec?.pid       ?? null,
      command:   rec?.command   ?? null,
      startedAt: rec?.startedAt ?? null,
      uptimeMs:  rec ? Date.now() - rec.startedAt : null,
    };
  },
};
