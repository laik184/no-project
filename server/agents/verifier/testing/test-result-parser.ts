/**
 * testing/test-result-parser.ts
 * Parses raw test runner output into structured results.
 * Called by server/tools/verifier/tests/test-result-parser.ts.
 */

export interface ParsedTestSuite {
  file:     string;
  passed:   number;
  failed:   number;
  skipped:  number;
}

export interface ParsedTestResults {
  suites:  ParsedTestSuite[];
  passed:  number;
  failed:  number;
  skipped: number;
  total:   number;
}

const PASS_RE  = /(\d+)\s+pass(?:ing)?/i;
const FAIL_RE  = /(\d+)\s+fail(?:ing)?/i;
const SKIP_RE  = /(\d+)\s+(?:pending|skip(?:ped)?)/i;
const SUITE_RE = /^(.+\.(?:spec|test)\.[jt]sx?)$/im;

export function parseTestOutput(output: string): ParsedTestResults {
  const passMatch = PASS_RE.exec(output);
  const failMatch = FAIL_RE.exec(output);
  const skipMatch = SKIP_RE.exec(output);

  const passed  = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failed  = failMatch ? parseInt(failMatch[1], 10) : 0;
  const skipped = skipMatch ? parseInt(skipMatch[1], 10) : 0;

  const suites: ParsedTestSuite[] = [];
  const suiteMatches = [...output.matchAll(new RegExp(SUITE_RE.source, 'gim'))];
  for (const m of suiteMatches) {
    suites.push({ file: m[1], passed: 0, failed: 0, skipped: 0 });
  }

  return { suites, passed, failed, skipped, total: passed + failed + skipped };
}

export function isTestRunPassed(results: ParsedTestResults): boolean {
  return results.failed === 0;
}
