/**
 * server/tools/terminal/process/list-processes-tool.ts
 * Tool: terminal_list_processes
 *
 * Lists all processes tracked by the runtime process store.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { listProcesses, isRunning }                  from '../runtime/process-store.ts';

export const listProcessesTool: ToolDefinition = {
  name:        'terminal_list_processes',
  category:    'terminal',
  description: 'List all tracked runtime processes and their current status.',
  inputSchema: {},
  permissions: ['read', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, _ctx: ToolExecutionContext) => {
    const records = listProcesses().map(rec => ({
      projectId: rec.projectId,
      pid:       rec.pid,
      command:   rec.command,
      startedAt: rec.startedAt,
      running:   isRunning(rec.projectId),
      uptimeMs:  Date.now() - rec.startedAt,
    }));

    return { total: records.length, processes: records };
  },
};
