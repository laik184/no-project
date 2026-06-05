/**
 * server/tools/terminal/runtime/start-runtime-tool.ts
 * Tool: terminal_start_runtime
 *
 * Starts a long-running process for a session via RuntimeService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { runtimeService }                            from '../../../services/terminal/index.ts';

export const startRuntimeTool: ToolDefinition = {
  name:        'terminal_start_runtime',
  category:    'terminal',
  description: 'Start a long-running runtime process for a session (e.g. npm start, node server.js).',
  inputSchema: {
    sessionId: { type: 'string', description: 'Terminal session identifier',                       required: true  },
    command:   { type: 'string', description: 'Command to run (e.g. "npm start")',                 required: true  },
    cwd:       { type: 'string', description: 'Absolute working directory (defaults to sandbox)',   required: false },
  },
  permissions: ['execute', 'process'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const sessionId = String(input.sessionId);
    const command   = String(input.command).trim();
    const cwd       = String(input.cwd ?? ctx.sandboxRoot);

    const info = runtimeService.start(sessionId, command, cwd);
    return { sessionId, pid: info.pid, command: info.command, running: true };
  },
};
