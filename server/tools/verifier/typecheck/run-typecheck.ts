import { runTypecheck as _runTypecheck } from '../../../agents/verifier/typecheck/typescript-checker.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { toToolOk, toToolFail } from '../shared/verifier-result.ts';
import { verifierMetrics }      from '../monitoring/verification-metrics.ts';

export { type TypecheckResult } from '../../../agents/verifier/typecheck/typescript-checker.ts';

export async function runTypecheck(runId: string, projectId: string) {
  return _runTypecheck(runId, projectId);
}

export const runTypecheckTool: ToolDefinition = {
  name:        'run_typecheck',
  category:    'verifier',
  description: 'Run TypeScript type-checking (tsc --noEmit) and parse errors',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    projectId: { type: 'string', description: 'Project ID', required: true },
  },
  permissions: ['execute'],
  timeoutMs:   60_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    const start = Date.now();
    try {
      const result = await runTypecheck(
        input.runId     as string,
        input.projectId as string,
      );
      const ms = Date.now() - start;
      verifierMetrics.recordTypecheck(ctx.runId, ms, result.passed);
      return result.passed
        ? toToolOk(result, ms)
        : toToolFail(`${result.errors.length} TypeScript error(s)`, ms);
    } catch (err) {
      return toToolFail(String(err), Date.now() - start);
    }
  },
};
