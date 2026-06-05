/**
 * server/tools/terminal/shell/mkdir-tool.ts
 * Tool: terminal_mkdir
 *
 * Creates a directory (and parents) inside the sandbox via ShellService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { shellService }                              from '../../../services/terminal/index.ts';

export const mkdirTool: ToolDefinition = {
  name:        'terminal_mkdir',
  category:    'terminal',
  description: 'Create a directory (including parent directories) inside the sandbox.',
  inputSchema: {
    path:      { type: 'string',  description: 'Directory path relative to sandbox root',             required: true  },
    recursive: { type: 'boolean', description: 'Create parent directories as needed (default: true)', required: false },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return shellService.mkdir(
      ctx.sandboxRoot,
      String(input.path),
      input.recursive !== false,
    );
  },
};
