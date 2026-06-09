/**
 * server/tools/terminal/process/list-processes-tool.ts
 * Tool: terminal_list_processes
 *
 * Lists all tracked processes via ProcessService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { processService }                            from '../../../services/terminal/index.ts';

export const listProcessesTool: ToolDefinition = {
  name:        'terminal_list_processes',
  category:    'terminal',
  description: 'List all tracked runtime processes and their current status.',
  inputSchema: {},
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, _ctx: ToolExecutionContext) => {
    const processes = processService.list();
    return { total: processes.length, processes };
  },
};
