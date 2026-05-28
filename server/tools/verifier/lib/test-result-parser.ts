export interface ParsedTestResults {
  passed:    number;
  failed:    number;
  skipped:   number;
  total:     number;
  duration?: number;
  suites:    string[];
  failures:  Array<{ name: string; message: string }>;
}

const VITEST_SUMMARY  = /Tests\s+(\d+)\s+failed.*?(\d+)\s+passed/i;
const JEST_SUMMARY    = /Tests:\s+(?:(\d+)\s+failed,\s+)?(\d+)\s+passed(?:,\s+(\d+)\s+skipped)?/i;
const MOCHA_SUMMARY   = /(\d+)\s+passing.*?(\d+)\s+failing/si;
const DURATION_RE     = /(?:Duration|Time):\s+([\d.]+)\s*s/i;
const FAILURE_BLOCK   = /(?:●|FAIL|\d+\)|×)\s+(.+?)(?:\n|$)(?:[^\n]*Error[^\n]*(?:\n|$))?/gi;

export function parseTestOutput(raw: string): ParsedTestResults {
  let passed = 0, failed = 0, skipped = 0;

  const vitest = VITEST_SUMMARY.exec(raw);
  if (vitest) {
    failed  = parseInt(vitest[1] ?? '0', 10);
    passed  = parseInt(vitest[2] ?? '0', 10);
  } else {
    const jest = JEST_SUMMARY.exec(raw);
    if (jest) {
      failed  = parseInt(jest[1] ?? '0', 10);
      passed  = parseInt(jest[2] ?? '0', 10);
      skipped = parseInt(jest[3] ?? '0', 10);
    } else {
      const mocha = MOCHA_SUMMARY.exec(raw);
      if (mocha) {
        passed = parseInt(mocha[1] ?? '0', 10);
        failed = parseInt(mocha[2] ?? '0', 10);
      }
    }
  }

  const durMatch = DURATION_RE.exec(raw);
  const duration = durMatch ? parseFloat(durMatch[1]!) * 1000 : undefined;

  const failures: Array<{ name: string; message: string }> = [];
  let m: RegExpExecArray | null;
  FAILURE_BLOCK.lastIndex = 0;
  while ((m = FAILURE_BLOCK.exec(raw)) !== null && failures.length < 20) {
    failures.push({ name: m[1]!.trim(), message: m[0].trim().slice(0, 200) });
  }

  const suiteRe = /(?:PASS|FAIL|✓|✗)\s+([\w./-]+\.(?:test|spec)\.[jt]sx?)/gi;
  const suites: string[] = [];
  while ((m = suiteRe.exec(raw)) !== null) suites.push(m[1]!);

  return { passed, failed, skipped, total: passed + failed + skipped, duration, suites, failures };
}

export function isTestRunPassed(parsed: ParsedTestResults): boolean {
  return parsed.failed === 0 && parsed.total >= 0;
}
