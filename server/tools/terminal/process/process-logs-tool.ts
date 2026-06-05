/**
 * server/tools/terminal/process/process-logs-tool.ts
 * Tool: terminal_process_logs
 *
 * Returns the captured stdout/stderr log lines for a tracked process.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { getProcess }                                from '../runtime/process-store.ts';

export const processLogsTool: ToolDefinition = {
  name:        'terminal_process_logs',
  category:    'terminal',
  description: 'Get recent stdout/stderr log lines for a tracked runtime process.',
  inputSchema: {
    projectId: { type: 'number', description: 'Project identifier',               required: true  },
    limit:     { type: 'number', description: 'Max lines to return (default 100)', required: false },
  },
  permissions: ['read', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const projectId = Number(input.projectId);
    const limit     = Math.min(Number(input.limit ?? 100), 500);
    const rec       = getProcess(projectId);

    if (!rec) {
      return { projectId, found: false, logs: [], total: 0 };
    }

    const logs = rec.logs.slice(-limit);
    return { projectId, found: true, logs, total: rec.logs.length };
  },
};
