/**
 * server/tools/terminal/runtime/stop-runtime-tool.ts
 * Tool: terminal_stop_runtime
 *
 * Stops the runtime process for a session via RuntimeService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { runtimeService }                            from '../../../services/terminal/index.ts';

export const stopRuntimeTool: ToolDefinition = {
  name:        'terminal_stop_runtime',
  category:    'terminal',
  description: 'Stop the running runtime process for a session.',
  inputSchema: {
    sessionId: { type: 'string',  description: 'Terminal session identifier', required: true  },
    force:     { type: 'boolean', description: 'Use SIGKILL (immediate)',     required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext) => {
    const sessionId = String(input.sessionId);
    const force     = Boolean(input.force);

    const current = runtimeService.status(sessionId);
    if (!current?.running) {
      return { sessionId, stopped: false, message: 'No running process found.' };
    }

    const stopped = runtimeService.stop(sessionId, force);
    return { sessionId, pid: current.pid, stopped };
  },
};
