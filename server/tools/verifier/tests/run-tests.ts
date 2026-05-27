import { runTests as _runTests } from '../../../agents/verifier/testing/test-runner.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { toToolOk, toToolFail } from '../shared/verifier-result.ts';
import { verifierMetrics }      from '../monitoring/verification-metrics.ts';

export { type TestRunResult } from '../../../agents/verifier/testing/test-runner.ts';

export async function runTests(runId: string, projectId: string, script = 'test') {
  return _runTests(runId, projectId, script);
}

export const runTestsTool: ToolDefinition = {
  name:        'run_tests',
  category:    'verifier',
  description: 'Run project test suite and parse results',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    projectId: { type: 'string', description: 'Project ID', required: true },
    script:    { type: 'string', description: 'npm test script (default: test)' },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    const start = Date.now();
    try {
      const result = await runTests(
        input.runId     as string,
        input.projectId as string,
        (input.script   as string) ?? 'test',
      );
      const ms = Date.now() - start;
      verifierMetrics.recordTests(ctx.runId, result.testCount - result.failCount, result.failCount);
      return result.passed
        ? toToolOk(result, ms)
        : toToolFail(`${result.failCount} test(s) failed: ${result.summary}`, ms);
    } catch (err) {
      return toToolFail(String(err), Date.now() - start);
    }
  },
};
