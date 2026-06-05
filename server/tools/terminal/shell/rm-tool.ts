/**
 * server/tools/terminal/shell/rm-tool.ts
 * Tool: terminal_rm
 *
 * Removes a file or directory inside the sandbox.
 */

import { rmSync, existsSync } from 'fs';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { resolveCwd }                                from '../validation/sandbox-validator.ts';

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
    const resolved  = resolveCwd(ctx.sandboxRoot, String(input.path));
    const recursive = Boolean(input.recursive);
    const force     = Boolean(input.force);

    if (!existsSync(resolved)) {
      if (force) return { path: resolved, removed: false, message: 'Path did not exist.' };
      throw new Error(`Path does not exist: ${resolved}`);
    }

    rmSync(resolved, { recursive, force });
    return { path: resolved, removed: true };
  },
};
