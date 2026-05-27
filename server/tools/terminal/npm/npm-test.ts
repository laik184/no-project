import { npmRunScript } from './npm-run-script.ts';
import type { ExecutionResult } from '../shared/terminal-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function npmTest(projectId: string): Promise<ExecutionResult> {
  return npmRunScript(projectId, 'test');
}

export const npmTestTool: ToolDefinition = {
  name: 'npm_test', category: 'terminal',
  description: 'Run npm test in a project sandbox',
  inputSchema: { projectId: { type: 'string', description: 'Project ID', required: true } },
  permissions: ['execute'], timeoutMs: 60_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => npmTest(input.projectId as string),
};
