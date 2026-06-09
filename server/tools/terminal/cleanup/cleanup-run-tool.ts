/**
 * server/tools/terminal/cleanup/cleanup-run-tool.ts
 * Tool: terminal_cleanup_run
 *
 * Cleans up temporary run artifacts: node_modules/.cache, .next/cache, dist/tmp, etc.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { commandService }                            from '../../../services/terminal/index.ts';

export const cleanupRunTool: ToolDefinition = {
  name:        'terminal_cleanup_run',
  category:    'terminal',
  description: 'Clean up build caches and temporary artifacts in the sandbox.',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID (for logging)',                       required: false },
    projectId: { type: 'string', description: 'Project ID (for logging)',                   required: false },
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const cleanup = 'rm -rf node_modules/.cache .next/cache dist/tmp .turbo 2>/dev/null; echo "cleanup done"';
    return commandService.execute(cleanup, {
      cwd:         input.cwd as string | undefined,
      sandboxRoot: ctx.sandboxRoot,
      timeoutMs:   30_000,
    });
  },
};
