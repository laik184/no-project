/**
 * Fix #6 — Terminal sandbox bypass.
 * Handler uses ctx.sandboxRoot directly instead of getSandboxRoot(input.projectId).
 */
import { shellExecute }  from '../execution/shell-execute.ts';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import type { ExecutionResult } from '../shared/terminal-types.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';

/** Backward-compatible wrapper. */
export async function npmCi(projectId: string): Promise<ExecutionResult> {
  return shellExecute('npm ci', getSandboxRoot(projectId), 120_000);
}

export const npmCiTool: ToolDefinition = {
  name: 'npm_ci', category: 'terminal',
  description: 'Run npm ci in a project sandbox',
  inputSchema: { projectId: { type: 'string', description: 'Project ID (display only)', required: false } },
  permissions: ['execute'], timeoutMs: 120_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (_input: Record<string, unknown>, ctx: ToolExecutionContext) =>
    shellExecute('npm ci', ctx.sandboxRoot, 120_000),
};
