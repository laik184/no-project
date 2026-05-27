import { shellExecute }  from '../execution/shell-execute.ts';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import type { ExecutionResult } from '../shared/terminal-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export async function npmRunScript(projectId: string, script: string): Promise<ExecutionResult> {
  const cwd = getSandboxRoot(projectId);
  return shellExecute(`npm run ${script}`, cwd, 60_000);
}

export const npmRunScriptTool: ToolDefinition = {
  name: 'npm_run_script', category: 'terminal',
  description: 'Run an npm script in a project sandbox',
  inputSchema: {
    projectId: { type: 'string', description: 'Project ID', required: true },
    script:    { type: 'string', description: 'Script name', required: true },
  },
  permissions: ['execute'], timeoutMs: 60_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) =>
    npmRunScript(input.projectId as string, input.script as string),
};
