/**
 * server/tools/terminal/npm/npm-ci-tool.ts
 * Tool: terminal_npm_ci
 *
 * Runs `npm ci` (clean install) in the sandbox.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { commandService }                            from '../../../services/terminal/index.ts';

export const npmCiTool: ToolDefinition = {
  name:        'terminal_npm_ci',
  category:    'terminal',
  description: 'Run `npm ci` (clean install from lockfile) in the sandbox.',
  inputSchema: {
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root', required: false },
    timeoutMs: { type: 'number', description: 'Max execution time in ms (default 180 000)',  required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.NPM,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return commandService.execute('npm ci 2>&1', {
      cwd:         input.cwd as string | undefined,
      sandboxRoot: ctx.sandboxRoot,
      timeoutMs:   input.timeoutMs ? Number(input.timeoutMs) : 180_000,
    });
  },
};
