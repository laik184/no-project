/**
 * server/tools/terminal/runtime/restart-runtime-tool.ts
 * Tool: terminal_restart_runtime
 *
 * Restarts the runtime process for a session via RuntimeService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { runtimeService }                            from '../../../services/terminal/index.ts';

export const restartRuntimeTool: ToolDefinition = {
  name:        'terminal_restart_runtime',
  category:    'terminal',
  description: 'Restart the runtime process for a session (stop then start).',
  inputSchema: {
    sessionId: { type: 'string', description: 'Terminal session identifier',                          required: true  },
    command:   { type: 'string', description: 'Command to run after restart (inherits previous if omitted)', required: false },
    cwd:       { type: 'string', description: 'Absolute working directory (defaults to sandbox)',      required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const sessionId = String(input.sessionId);
    const cwd       = String(input.cwd ?? ctx.sandboxRoot);
    const command   = input.command ? String(input.command).trim() : undefined;

    const info = await runtimeService.restart(sessionId, cwd, { command });
    return { sessionId, pid: info.pid, command: info.command, restarted: true };
  },
};
