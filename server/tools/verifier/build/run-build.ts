import { runBuild as _runBuild } from '../../../agents/verifier/build/build-runner.ts';
import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }  from '../shared/verifier-result.ts';
import { verifierMetrics }       from '../monitoring/verification-metrics.ts';

export { type BuildRunResult } from '../../../agents/verifier/build/build-runner.ts';

export async function runBuild(
  runId:     string,
  projectId: string,
  script     = 'build',
) {
  return _runBuild(runId, projectId, script);
}

export const runBuildTool: ToolDefinition = {
  name:        'run_build',
  category:    'verifier',
  description: 'Run the project build and parse errors/warnings',
  inputSchema: {
    runId:     { type: 'string', description: 'Run ID',     required: true },
    projectId: { type: 'string', description: 'Project ID', required: true },
    script:    { type: 'string', description: 'npm script (default: build)' },
  },
  permissions: ['execute'],
  timeoutMs:   120_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    const start = Date.now();
    try {
      const result = await runBuild(
        input.runId     as string,
        input.projectId as string,
        (input.script   as string) ?? 'build',
      );
      const ms = Date.now() - start;
      verifierMetrics.recordBuild(ctx.runId, ms, result.passed);
      return result.passed
        ? toToolOk(result, ms)
        : toToolFail(result.errors.map(e => e.message).join('; ') || 'Build failed', ms);
    } catch (err) {
      return toToolFail(String(err), Date.now() - start);
    }
  },
};
