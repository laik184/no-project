import { npmRunScript, npmTest } from '../../terminal/npm/npm-script-runner.ts';
import { assertWorkspaceReady } from '../../terminal/workspace/workspace-resolver.ts';
import { parseTestOutput, isTestRunPassed } from './test-result-parser.ts';
import { analyzeTestFailures, failuresToParsedErrors } from './test-failure-analyzer.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';
import type { ParsedError } from '../types/diagnostics.types.ts';

const TEST_TIMEOUT_MS = 120_000;

export interface TestRunResult {
  passed:    boolean;
  exitCode:  number;
  errors:    ParsedError[];
  testCount: number;
  failCount: number;
  summary:   string;
  rawOutput: string;
}

export async function runTests(
  runId:     string,
  projectId: string,
  script     = 'test',
): Promise<TestRunResult> {
  verifierLogger.phase(runId, 'tests', 'start', { script });

  await assertWorkspaceReady(projectId);

  const result = await npmRunScript(runId, projectId, script, TEST_TIMEOUT_MS)
    .catch(() => npmTest(runId, projectId));

  const stdout   = result.stdout ?? '';
  const stderr   = result.stderr ?? '';
  const exitCode = result.exitCode ?? 1;
  const rawOutput = `${stdout}\n${stderr}`.trim();

  const parsed   = parseTestOutput(rawOutput);
  const passed   = isTestRunPassed(parsed) && exitCode === 0;
  const failures = analyzeTestFailures(parsed);
  const errors   = failuresToParsedErrors(failures);

  verifierMetrics.recordTestRun(runId, parsed.passed, parsed.failed);

  const summary = passed
    ? `${parsed.passed} tests passed`
    : `${parsed.failed} failed, ${parsed.passed} passed`;

  verifierLogger.phase(runId, 'tests', passed ? 'end' : 'fail', {
    passed: parsed.passed, failed: parsed.failed,
  });

  return {
    passed,
    exitCode,
    errors,
    testCount: parsed.total,
    failCount: parsed.failed,
    summary,
    rawOutput,
  };
}
