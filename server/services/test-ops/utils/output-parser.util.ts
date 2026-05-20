import type { CoverageReport, TestCase } from "../types.js";

const PERCENT_RE = /(\d+(?:\.\d+)?)%/;

export function parsePassFailCounts(raw: string): { passed: number; failed: number } {
  const passedMatch = raw.match(/(\d+)\s+passed/i) ?? raw.match(/pass(?:ed)?:\s*(\d+)/i);
  const failedMatch = raw.match(/(\d+)\s+failed/i) ?? raw.match(/fail(?:ed)?:\s*(\d+)/i);

  return {
    passed: Number(passedMatch?.[1] ?? 0),
    failed: Number(failedMatch?.[1] ?? 0),
  };
}

export function parseCoverage(raw: string): CoverageReport {
  const line = raw.split("\n").find((entry) => /all files|statements|coverage/i.test(entry));
  const percentage = line?.match(PERCENT_RE)?.[1] ? Number(line.match(PERCENT_RE)?.[1]) : 0;

  return Object.freeze({
    enabled: percentage > 0,
    percentage,
    statementCoverage: percentage,
  });
}

export function parseTestCases(raw: string): readonly TestCase[] {
  const lines = raw.split("\n");
  const tests: TestCase[] = [];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    if (cleanLine.startsWith("✓") || cleanLine.startsWith("PASS")) {
      tests.push(Object.freeze({
        name: cleanLine.replace(/^✓\s*/, "").replace(/^PASS\s*/, ""),
        file: "unknown",
        status: "passed",
      }));
      continue;
    }

    if (cleanLine.startsWith("✗") || cleanLine.startsWith("FAIL")) {
      tests.push(Object.freeze({
        name: cleanLine.replace(/^✗\s*/, "").replace(/^FAIL\s*/, ""),
        file: "unknown",
        status: "failed",
      }));
    }
  }

  return Object.freeze(tests);
}

export function parseFailureReasons(raw: string): readonly string[] {
  const lines = raw.split("\n");
  const reasons: string[] = [];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (/^Error:/i.test(cleanLine) || /^AssertionError:/i.test(cleanLine)) {
      reasons.push(cleanLine);
    }
  }

  return Object.freeze(reasons);
}
