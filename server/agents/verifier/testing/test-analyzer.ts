import type { ParsedError } from '../types.ts';
import { parseLines } from '../utils.ts';

export interface TestSuite {
  name: string; passed: number; failed: number; skipped: number; errors: string[];
}

export interface ParsedTestResults {
  passed: number; failed: number; skipped: number; total: number;
  suites: TestSuite[]; duration?: number; rawOutput: string;
}

const JEST_PATTERN   = /tests:\s+(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+skipped,\s*)?(\d+)\s+passed/i;
const VITEST_PATTERN = /(\d+)\s+passed\s*\|\s*(\d+)\s+failed/i;
const MOCHA_PATTERN  = /(\d+)\s+passing.*?(\d+)\s+failing/i;

export function parseTestOutput(rawOutput: string): ParsedTestResults {
  let passed = 0, failed = 0, skipped = 0;

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
      if (mocha) { passed = parseInt(mocha[1], 10); failed = parseInt(mocha[2], 10); }
    }
  }

  const durationMatch = rawOutput.match(/(?:done in|time:)\s*([\d.]+)\s*ms/i);
  const duration      = durationMatch ? parseInt(durationMatch[1], 10) : undefined;
  const failedSuites  = parseLines(rawOutput).filter((l) => /✕|✗|FAIL\b|× /i.test(l)).map((l) => l.trim());
  const suites: TestSuite[] = failedSuites.map((name) => ({ name, passed: 0, failed: 1, skipped: 0, errors: [name] }));

  return { passed, failed, skipped, total: passed + failed + skipped, suites, duration, rawOutput };
}

export function isTestRunPassed(results: ParsedTestResults): boolean {
  return results.failed === 0 && results.total > 0;
}

export type TestFailureKind = 'assertion' | 'timeout' | 'import' | 'runtime' | 'unknown';

export interface AnalyzedTestFailure {
  kind: TestFailureKind; message: string; suite?: string; file?: string;
}

const ASSERTION_PATTERN   = /expected.*received|assert.*fail|tobedefined|tobe|toequal/i;
const TIMEOUT_PATTERN     = /timeout|exceeded.*ms|async.*not.*resolve/i;
const IMPORT_FAIL_PATTERN = /cannot find module|failed.*import|module.*not.*found/i;

export function classifyTestError(message: string): TestFailureKind {
  if (ASSERTION_PATTERN.test(message))   return 'assertion';
  if (TIMEOUT_PATTERN.test(message))     return 'timeout';
  if (IMPORT_FAIL_PATTERN.test(message)) return 'import';
  if (/error:/i.test(message))           return 'runtime';
  return 'unknown';
}

export function analyzeTestFailures(results: ParsedTestResults): AnalyzedTestFailure[] {
  const failures: AnalyzedTestFailure[] = [];
  for (const suite of results.suites) {
    for (const err of suite.errors) {
      failures.push({ kind: classifyTestError(err), message: err.slice(0, 300), suite: suite.name });
    }
  }
  if (failures.length === 0 && results.failed > 0) {
    const lines = parseLines(results.rawOutput).filter((l) => /✕|✗|FAIL|× |Error:/i.test(l)).slice(0, 10);
    for (const line of lines) failures.push({ kind: classifyTestError(line), message: line.trim() });
  }
  return failures;
}

export function failuresToParsedErrors(failures: AnalyzedTestFailure[]): ParsedError[] {
  return failures.map((f) => ({ message: f.message, severity: 'error' as const, category: 'test' as const, file: f.file, raw: f.message }));
}

export function buildTestFailureSummary(failures: AnalyzedTestFailure[]): string {
  if (failures.length === 0) return 'All tests passed';
  const byKind = failures.reduce((acc, f) => { acc[f.kind] = (acc[f.kind] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  return Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ');
}

export interface CoverageThresholds { lines?: number; functions?: number; branches?: number; statements?: number; }
export interface CoverageResult     { lines?: number; functions?: number; branches?: number; statements?: number; }
export interface CoverageValidationResult { passed: boolean; errors: string[]; coverage: CoverageResult; }

export function parseCoverageOutput(output: string): CoverageResult {
  function extract(pattern: RegExp): number | undefined {
    const m = output.match(pattern); return m ? parseFloat(m[1]) : undefined;
  }
  return {
    lines:      extract(/lines\s*[:\|]\s*([\d.]+)%/i),
    functions:  extract(/(?:functions|funcs)\s*[:\|]\s*([\d.]+)%/i),
    branches:   extract(/branches\s*[:\|]\s*([\d.]+)%/i),
    statements: extract(/statements\s*[:\|]\s*([\d.]+)%/i),
  };
}

export function validateCoverage(output: string, thresholds: CoverageThresholds): CoverageValidationResult {
  const coverage = parseCoverageOutput(output);
  const errors:  string[] = [];
  const checks: Array<[keyof CoverageResult, number | undefined]> = [
    ['lines', thresholds.lines], ['functions', thresholds.functions],
    ['branches', thresholds.branches], ['statements', thresholds.statements],
  ];
  for (const [key, threshold] of checks) {
    if (threshold === undefined) continue;
    const actual = coverage[key];
    if (actual === undefined) errors.push(`Coverage metric "${key}" not found in output`);
    else if (actual < threshold) errors.push(`Coverage "${key}" is ${actual}%, below threshold ${threshold}%`);
  }
  return { passed: errors.length === 0, errors, coverage };
}
