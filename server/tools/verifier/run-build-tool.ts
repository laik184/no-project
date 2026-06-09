/**
 * server/tools/verifier/run-build-tool.ts
 * Tool: run_build
 *
 * Runs `npm run build` in the sandbox and returns pass/fail with output.
 * Returns: { passed, stdout, stderr, exitCode, durationMs }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface BuildResult {
  passed:     boolean;
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  durationMs: number;
}

export const runBuildTool: ToolDefinition = {
  name:        'run_build',
  category:    'verifier',
  description: 'Run `npm run build` in the sandbox and return pass/fail with full output.',
  inputSchema: {
    runId:     { type: 'string', description: 'Execution run ID', required: false },
    projectId: { type: 'string', description: 'Project ID',       required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<BuildResult> => {
    const sandboxRoot = (ctx.sandboxRoot as string | undefined) ?? '.sandbox';
    const start = Date.now();

    const result = await commandService.execute('npm run build 2>&1', {
      sandboxRoot,
      timeoutMs: 115_000,
    });

    return {
      passed:     (result.exitCode ?? 0) === 0,
      stdout:     result.stdout ?? '',
      stderr:     result.stderr ?? '',
      exitCode:   result.exitCode ?? 0,
      durationMs: Date.now() - start,
    };
  },
};
