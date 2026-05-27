/**
 * Fix #6 — Terminal sandbox bypass.
 * Handler uses ctx.sandboxRoot via npmRunScriptInCwd.
 */
import { npmRunScript, npmRunScriptInCwd } from './npm-run-script.ts';
import type { ExecutionResult }            from '../shared/terminal-types.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';

/** Backward-compatible wrapper. */
export async function npmTest(projectId: string): Promise<ExecutionResult> {
  return npmRunScript(projectId, 'test');
}

export const npmTestTool: ToolDefinition = {
  name: 'npm_test', category: 'terminal',
  description: 'Run npm test in a project sandbox',
  inputSchema: { projectId: { type: 'string', description: 'Project ID (display only)', required: false } },
  permissions: ['execute'], timeoutMs: 60_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input: Record<string, unknown>, ctx: ToolExecutionContext) =>
    npmRunScriptInCwd(ctx.sandboxRoot, 'test'),
};
