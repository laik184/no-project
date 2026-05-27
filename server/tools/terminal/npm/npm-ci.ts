import { shellExecute }  from '../execution/shell-execute.ts';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import type { ExecutionResult } from '../shared/terminal-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function npmCi(projectId: string): Promise<ExecutionResult> {
  const cwd = getSandboxRoot(projectId);
  return shellExecute('npm ci', cwd, 120_000);
}

export const npmCiTool: ToolDefinition = {
  name: 'npm_ci', category: 'terminal',
  description: 'Run npm ci in a project sandbox',
  inputSchema: { projectId: { type: 'string', description: 'Project ID', required: true } },
  permissions: ['execute'], timeoutMs: 120_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => npmCi(input.projectId as string),
};
