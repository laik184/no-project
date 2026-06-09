/**
 * server/tools/verifier/run-tests-tool.ts
 * Tool: run_tests
 *
 * Runs a test script (default: `npm test`) in the sandbox.
 * Returns: { passed, stdout, stderr, exitCode, durationMs }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface TestsResult {
  passed:     boolean;
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  durationMs: number;
  script:     string;
}

export const runTestsTool: ToolDefinition = {
  name:        'run_tests',
  category:    'verifier',
  description: 'Run a test script (e.g. `npm test`) in the sandbox and return pass/fail.',
  inputSchema: {
    runId:     { type: 'string', description: 'Execution run ID',                          required: false },
    projectId: { type: 'string', description: 'Project ID',                                required: false },
    script:    { type: 'string', description: 'npm script to run (default: test)',          required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<TestsResult> => {
    const sandboxRoot = (ctx.sandboxRoot as string | undefined) ?? '.sandbox';
    const script      = (input.script as string | undefined) ?? 'test';
    const start       = Date.now();

    const result = await commandService.execute(`npm run ${script} 2>&1`, {
      sandboxRoot,
      timeoutMs: 115_000,
    });

    return {
      passed:     (result.exitCode ?? 0) === 0,
      stdout:     result.stdout ?? '',
      stderr:     result.stderr ?? '',
      exitCode:   result.exitCode ?? 0,
      durationMs: Date.now() - start,
      script,
    };
  },
};
