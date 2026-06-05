/**
 * server/tools/terminal/shell/ls-tool.ts
 * Tool: terminal_ls
 *
 * Lists directory contents via ShellService.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { shellService }                              from '../../../services/terminal/index.ts';

export const lsTool: ToolDefinition = {
  name:        'terminal_ls',
  category:    'terminal',
  description: 'List the contents of a directory inside the sandbox.',
  inputSchema: {
    path: { type: 'string',  description: 'Directory path relative to sandbox root (default: ".")', required: false },
    all:  { type: 'boolean', description: 'Include hidden files (dotfiles)',                         required: false },
  },
  permissions: ['read'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return shellService.ls(
      ctx.sandboxRoot,
      input.path as string | undefined,
      Boolean(input.all),
    );
  },
};
