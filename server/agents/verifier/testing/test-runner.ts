/**
 * testing/test-runner.ts
 * Runs the project test suite and returns structured results.
 * Called by server/tools/verifier/tests/run-tests.ts.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execAsync    = promisify(exec);
const SANDBOX_ROOT = process.env['AGENT_PROJECT_ROOT'] ?? '.sandbox';

export interface TestRunResult {
  passed:     boolean;
  testCount:  number;
  failCount:  number;
  passCount:  number;
  skipped:    number;
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  durationMs: number;
  summary:    string;
}

export async function runTests(
  runId:     string,
  projectId: string,
  script = 'test',
): Promise<TestRunResult> {
  const cwd   = path.join(SANDBOX_ROOT, projectId);
  const start = Date.now();

  try {
    const { stdout, stderr } = await execAsync(
      `npm run ${script} --passWithNoTests 2>&1`,
      { cwd, timeout: 120_000, env: { ...process.env, CI: 'true' } },
    );
    const durationMs = Date.now() - start;
    const counts     = parseTestCounts(stdout + stderr);
    return { passed: counts.failCount === 0, ...counts, stdout, stderr, exitCode: 0, durationMs, summary: `${counts.passCount} passed, ${counts.failCount} failed` };
  } catch (err: unknown) {
    const e        = err as { stdout?: string; stderr?: string; code?: number };
    const stdout   = e.stdout ?? '';
    const stderr   = e.stderr ?? '';
    const durationMs = Date.now() - start;
    const counts   = parseTestCounts(stdout + stderr);
    return { passed: false, ...counts, stdout, stderr, exitCode: e.code ?? 1, durationMs, summary: `${counts.passCount} passed, ${counts.failCount} failed` };
  }
}

function parseTestCounts(output: string): { testCount: number; passCount: number; failCount: number; skipped: number } {
  const passMatch = /(\d+)\s+passing/.exec(output);
  const failMatch = /(\d+)\s+failing/.exec(output);
  const skipMatch = /(\d+)\s+(?:pending|skipped)/.exec(output);
  const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failCount = failMatch ? parseInt(failMatch[1], 10) : 0;
  const skipped   = skipMatch ? parseInt(skipMatch[1], 10) : 0;
  return { testCount: passCount + failCount + skipped, passCount, failCount, skipped };
}
