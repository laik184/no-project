import { shellExecute }    from '../../terminal/execution/shell-execute.ts';
import { parseBuildErrors } from './build-error-parser.ts';
import { analyzeBuildOutput } from './build-output-analyzer.ts';
import { join }             from 'path';

export interface BuildRunResult {
  passed:     boolean;
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  errors:     ReturnType<typeof parseBuildErrors>;
  durationMs: number;
  summary:    string;
}

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export async function runBuild(
  runId:     string,
  projectId: string,
  script     = 'build',
): Promise<BuildRunResult> {
  const cwd   = join(SANDBOX_ROOT, projectId);
  const start = Date.now();
  const result = await shellExecute(`npm run ${script}`, cwd, 120_000);
  const durationMs = Date.now() - start;
  const combined   = [result.stdout, result.stderr].join('\n');
  const errors     = parseBuildErrors(combined);
  const analysis   = analyzeBuildOutput(result.stdout, result.stderr);
  const passed     = result.exitCode === 0 && !analysis.hasErrors;
  const summary    = passed
    ? `Build passed in ${durationMs}ms`
    : `Build failed (${errors.length} error(s))`;
  return { passed, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, errors, durationMs, summary };
}
