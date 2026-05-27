import { parseLines, extractNumber } from '../utils/parser-utils.ts';

export interface TestSuite {
  name:    string;
  passed:  number;
  failed:  number;
  skipped: number;
  errors:  string[];
}

export interface ParsedTestResults {
  passed:    number;
  failed:    number;
  skipped:   number;
  total:     number;
  suites:    TestSuite[];
  duration?: number;
  rawOutput: string;
}

const SUMMARY_PATTERNS = [
  /(\d+)\s+passed/i,
  /(\d+)\s+failed/i,
  /(\d+)\s+skipped/i,
];

const JEST_PATTERN  = /tests:\s+(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+skipped,\s*)?(\d+)\s+passed/i;
const VITEST_PATTERN = /(\d+)\s+passed\s*\|\s*(\d+)\s+failed/i;
const MOCHA_PATTERN  = /(\d+)\s+passing.*?(\d+)\s+failing/i;

export function parseTestOutput(rawOutput: string): ParsedTestResults {
  const lines = parseLines(rawOutput);
  let passed  = 0, failed = 0, skipped = 0;

  const jest = rawOutput.match(JEST_PATTERN);
  if (jest) {
    failed  = parseInt(jest[1] ?? '0', 10);
    skipped = parseInt(jest[2] ?? '0', 10);
    passed  = parseInt(jest[3] ?? '0', 10);
  } else {
    const vitest = rawOutput.match(VITEST_PATTERN);
    if (vitest) {
      passed = parseInt(vitest[1], 10);
      failed = parseInt(vitest[2], 10);
    } else {
      const mocha = rawOutput.match(MOCHA_PATTERN);
      if (mocha) {
        passed = parseInt(mocha[1], 10);
        failed = parseInt(mocha[2], 10);
      }
    }
  }

  const duration = extractNumber(rawOutput, /(?:done in|time:)\s*([\d.]+)\s*ms/i);
  const failedSuites = lines
    .filter((l) => /✕|✗|FAIL\b|× /i.test(l))
    .map((l) => l.trim());

  const suites: TestSuite[] = failedSuites.map((name) => ({
    name, passed: 0, failed: 1, skipped: 0, errors: [name],
  }));

  return { passed, failed, skipped, total: passed + failed + skipped, suites, duration, rawOutput };
}

export function isTestRunPassed(results: ParsedTestResults): boolean {
  return results.failed === 0 && results.total > 0;
}
