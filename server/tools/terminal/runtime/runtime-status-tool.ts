/**
 * server/tools/terminal/runtime/runtime-status-tool.ts
 * Tool: terminal_runtime_status
 *
 * Returns the current status of the runtime process for a session via RuntimeService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { runtimeService }                            from '../../../services/terminal/index.ts';

export const runtimeStatusTool: ToolDefinition = {
  name:        'terminal_runtime_status',
  category:    'terminal',
  description: 'Get the current status of the runtime process for a session.',
  inputSchema: {
    sessionId: { type: 'string', description: 'Terminal session identifier', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const sessionId = String(input.sessionId);
    const info      = runtimeService.status(sessionId);

    if (!info) {
      return { sessionId, running: false, pid: null, command: null, startedAt: null, uptimeMs: null };
    }

    return {
      sessionId,
      running:   info.running,
      pid:       info.pid,
      command:   info.command,
      cwd:       info.cwd,
      startedAt: info.startedAt,
      uptimeMs:  info.uptimeMs,
    };
  },
};
