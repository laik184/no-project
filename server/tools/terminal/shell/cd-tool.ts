/**
 * server/tools/terminal/shell/cd-tool.ts
 * Tool: terminal_cd
 *
 * Validates and resolves a directory path within the sandbox via ShellService.
 * Stateless — does not persist cwd, returns resolved path for use in subsequent calls.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { shellService }                              from '../../../services/terminal/index.ts';

export const cdTool: ToolDefinition = {
  name:        'terminal_cd',
  category:    'terminal',
  description: 'Validate and resolve a directory path within the sandbox. Returns the absolute path.',
  inputSchema: {
    path: { type: 'string', description: 'Directory path relative to sandbox root', required: true },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return shellService.cd(ctx.sandboxRoot, String(input.path));
  },
};
