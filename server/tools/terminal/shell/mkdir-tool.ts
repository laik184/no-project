/**
 * server/tools/terminal/shell/mkdir-tool.ts
 * Tool: terminal_mkdir
 *
 * Creates a directory (and parents) inside the sandbox.
 */

import { mkdirSync, existsSync } from 'fs';
import { join }                  from 'path';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { resolveCwd }                                from '../validation/sandbox-validator.ts';

export const mkdirTool: ToolDefinition = {
  name:        'terminal_mkdir',
  category:    'terminal',
  description: 'Create a directory (including parent directories) inside the sandbox.',
  inputSchema: {
    path:      { type: 'string',  description: 'Directory path relative to sandbox root', required: true  },
    recursive: { type: 'boolean', description: 'Create parent directories as needed (default: true)', required: false },
  },
  permissions: ['write'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const resolved  = resolveCwd(ctx.sandboxRoot, String(input.path));
    const recursive = input.recursive !== false;
    const existed   = existsSync(resolved);

    if (!existed) {
      mkdirSync(resolved, { recursive });
    }

    return { path: resolved, created: !existed };
  },
};
