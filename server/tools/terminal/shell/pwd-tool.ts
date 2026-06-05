/**
 * server/tools/terminal/shell/pwd-tool.ts
 * Tool: terminal_pwd
 *
 * Returns the current sandbox working directory via ShellService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { shellService }                              from '../../../services/terminal/index.ts';

export const pwdTool: ToolDefinition = {
  name:        'terminal_pwd',
  category:    'terminal',
  description: 'Return the absolute path of the current working directory within the sandbox.',
  inputSchema: {
    cwd: { type: 'string', description: 'Sub-path relative to sandbox root (optional)', required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return shellService.pwd(ctx.sandboxRoot, input.cwd as string | undefined);
  },
};
