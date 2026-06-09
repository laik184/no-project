/**
 * server/tools/terminal/npm/npm-build-tool.ts
 * Tool: terminal_npm_build
 *
 * Runs `npm run build` in the sandbox.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { commandService }                            from '../../../services/terminal/index.ts';

export const npmBuildTool: ToolDefinition = {
  name:        'terminal_npm_build',
  category:    'terminal',
  description: 'Run `npm run build` in the sandbox and return stdout/stderr.',
  inputSchema: {
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root', required: false },
    timeoutMs: { type: 'number', description: 'Max execution time in ms (default 120 000)',  required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    return commandService.execute('npm run build 2>&1', {
      cwd:         input.cwd as string | undefined,
      sandboxRoot: ctx.sandboxRoot,
      timeoutMs:   input.timeoutMs ? Number(input.timeoutMs) : 120_000,
    });
  },
};
