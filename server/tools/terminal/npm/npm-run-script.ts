/**
 * server/tools/terminal/npm/npm-run-script.ts
 *
 * Fix #6 — Terminal sandbox bypass.
 * Handler uses ctx.sandboxRoot, not getSandboxRoot(input.projectId).
 */

import { shellExecute }         from '../execution/shell-execute.ts';
import { getSandboxRoot }       from '../validation/sandbox-validator.ts';
import type { ExecutionResult } from '../shared/terminal-types.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';

export async function npmRunScriptInCwd(
  cwd:    string,
  script: string,
): Promise<ExecutionResult> {
  return shellExecute(`npm run ${script}`, cwd, 60_000);
}

/** Backward-compatible wrapper. */
export async function npmRunScript(
  projectId: string,
  script:    string,
): Promise<ExecutionResult> {
  return npmRunScriptInCwd(getSandboxRoot(projectId), script);
}

export const npmRunScriptTool: ToolDefinition = {
  name:        'npm_run_script',
  category:    'terminal',
  description: 'Run an npm script in a project sandbox',
  inputSchema: {
    projectId: { type: 'string', description: 'Project ID (display only)', required: false },
    script:    { type: 'string', description: 'Script name', required: true },
  },
  permissions: ['execute'],
  timeoutMs:   60_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>, ctx: ToolExecutionContext) =>
    npmRunScriptInCwd(ctx.sandboxRoot, input.script as string),
};
