/**
 * server/tools/terminal/npm/npm-build.ts
 *
 * Fix #6 — Terminal sandbox bypass.
 * Handler uses ctx.sandboxRoot via npmRunScriptInCwd.
 */

import { npmRunScriptInCwd, npmRunScript } from './npm-run-script.ts';
import type { ExecutionResult }            from '../shared/terminal-types.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';

export async function npmBuild(projectId: string): Promise<ExecutionResult> {
  return npmRunScript(projectId, 'build');
}

export const npmBuildTool: ToolDefinition = {
  name:        'npm_build',
  category:    'terminal',
  description: 'Run npm build in a project sandbox',
  inputSchema: {
    projectId: { type: 'string', description: 'Project ID (display only)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   60_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input: Record<string, unknown>, ctx: ToolExecutionContext) =>
    npmRunScriptInCwd(ctx.sandboxRoot, 'build'),
};
