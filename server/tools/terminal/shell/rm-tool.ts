/**
 * server/tools/terminal/shell/rm-tool.ts
 * Tool: terminal_rm
 *
 * Removes a file or directory inside the sandbox via ShellService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { shellService }                              from '../../../services/terminal/index.ts';

export const rmTool: ToolDefinition = {
  name:        'terminal_rm',
  category:    'terminal',
  description: 'Remove a file or directory inside the sandbox.',
  inputSchema: {
    path:      { type: 'string',  description: 'Path relative to sandbox root to remove', required: true  },
    recursive: { type: 'boolean', description: 'Remove directories recursively',           required: false },
    force:     { type: 'boolean', description: 'Ignore if path does not exist',            required: false },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return shellService.rm(
      ctx.sandboxRoot,
      String(input.path),
      Boolean(input.recursive),
      Boolean(input.force),
    );
  },
};
