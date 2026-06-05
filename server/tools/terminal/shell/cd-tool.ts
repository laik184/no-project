/**
 * server/tools/terminal/shell/cd-tool.ts
 * Tool: terminal_cd
 *
 * Resolves and validates a path within the sandbox.
 * Note: since each tool invocation is stateless, this does not
 * persist cwd — it validates and returns the resolved path for
 * use in subsequent commands.
 */

import { existsSync, statSync } from 'fs';
import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { resolveCwd }                                from '../validation/sandbox-validator.ts';

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
    const resolved = resolveCwd(ctx.sandboxRoot, String(input.path));

    if (!existsSync(resolved)) {
      throw new Error(`Directory does not exist: ${resolved}`);
    }
    if (!statSync(resolved).isDirectory()) {
      throw new Error(`Path is not a directory: ${resolved}`);
    }

    return { resolved, sandboxRoot: ctx.sandboxRoot };
  },
};
