/**
 * server/tools/terminal/process/process-logs-tool.ts
 * Tool: terminal_process_logs
 *
 * Returns captured log lines for a tracked process session.
 * Uses ProcessService to verify the session, LogService to retrieve lines.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { processService, terminalLogService }        from '../../../services/terminal/index.ts';

export const processLogsTool: ToolDefinition = {
  name:        'terminal_process_logs',
  category:    'terminal',
  description: 'Get recent stdout/stderr log lines for a tracked runtime process session.',
  inputSchema: {
    sessionId: { type: 'string', description: 'Terminal session identifier',         required: true  },
    limit:     { type: 'number', description: 'Max lines to return (default 100)',   required: false },
    source:    { type: 'string', description: 'Filter by source: stdout | stderr',   required: false },
  },
  permissions: ['read', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const sessionId = String(input.sessionId);
    const limit     = Math.min(Number(input.limit ?? 100), 500);
    const source    = input.source as 'stdout' | 'stderr' | undefined;

    const status = processService.status(sessionId);
    if (!status) {
      return { sessionId, found: false, logs: [], total: 0 };
    }

    const all  = source
      ? terminalLogService.filterBySource(sessionId, source)
      : terminalLogService.get(sessionId, limit);

    const logs = source ? all.slice(-limit) : all;
    return { sessionId, found: true, running: status.running, logs, total: logs.length };
  },
};
