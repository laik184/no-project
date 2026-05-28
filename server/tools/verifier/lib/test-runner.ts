import { shellExecute }    from '../../terminal/execution/shell-execute.ts';
import { parseTestOutput } from './test-result-parser.ts';
import { join }            from 'path';

export interface TestRunResult {
  passed:     boolean;
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  testCount:  number;
  failCount:  number;
  passCount:  number;
  durationMs: number;
  summary:    string;
}

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export async function runTests(
  runId:     string,
  projectId: string,
  script     = 'test',
): Promise<TestRunResult> {
  const cwd    = join(SANDBOX_ROOT, projectId);
  const start  = Date.now();
  const result = await shellExecute(`npm run ${script} -- --ci 2>&1 || true`, cwd, 120_000);
  const durationMs = Date.now() - start;
  const combined   = [result.stdout, result.stderr].join('\n');
  const parsed     = parseTestOutput(combined);
  const passed     = result.exitCode === 0 && parsed.failed === 0;
  const summary    = `${parsed.passed} passed, ${parsed.failed} failed${parsed.skipped ? `, ${parsed.skipped} skipped` : ''}`;
  return {
    passed,
    exitCode:  result.exitCode,
    stdout:    result.stdout,
    stderr:    result.stderr,
    testCount: parsed.total,
    failCount: parsed.failed,
    passCount: parsed.passed,
    durationMs,
    summary,
  };
}
