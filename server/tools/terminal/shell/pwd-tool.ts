/**
 * server/tools/terminal/shell/pwd-tool.ts
 * Tool: terminal_pwd
 *
 * Returns the current sandbox working directory.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';

export const pwdTool: ToolDefinition = {
  name:        'terminal_pwd',
  category:    'terminal',
  description: 'Return the absolute path of the sandbox root (working directory).',
  inputSchema: {},
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    return { cwd: ctx.sandboxRoot };
  },
};
