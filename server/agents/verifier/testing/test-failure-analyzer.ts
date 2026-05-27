import type { ParsedError } from '../types/diagnostics.types.ts';
import type { ParsedTestResults, TestSuite } from './test-result-parser.ts';
import { parseLines } from '../utils/parser-utils.ts';

const ASSERTION_PATTERN   = /expected.*received|assert.*fail|tobedefined|tobe|toequal/i;
const TIMEOUT_PATTERN     = /timeout|exceeded.*ms|async.*not.*resolve/i;
const IMPORT_FAIL_PATTERN = /cannot find module|failed.*import|module.*not.*found/i;

export type TestFailureKind = 'assertion' | 'timeout' | 'import' | 'runtime' | 'unknown';

export interface AnalyzedTestFailure {
  kind:    TestFailureKind;
  message: string;
  suite?:  string;
  file?:   string;
}

export function analyzeTestFailures(results: ParsedTestResults): AnalyzedTestFailure[] {
  const failures: AnalyzedTestFailure[] = [];

  for (const suite of results.suites) {
    for (const err of suite.errors) {
      failures.push({
        kind:    classifyTestError(err),
        message: err.slice(0, 300),
        suite:   suite.name,
      });
    }
  }

  if (failures.length === 0 && results.failed > 0) {
    const lines = parseLines(results.rawOutput)
      .filter((l) => /✕|✗|FAIL|× |Error:/i.test(l))
      .slice(0, 10);

    for (const line of lines) {
      failures.push({ kind: classifyTestError(line), message: line.trim() });
    }
  }

  return failures;
}

export function classifyTestError(message: string): TestFailureKind {
  if (ASSERTION_PATTERN.test(message))   return 'assertion';
  if (TIMEOUT_PATTERN.test(message))     return 'timeout';
  if (IMPORT_FAIL_PATTERN.test(message)) return 'import';
  if (/error:/i.test(message))           return 'runtime';
  return 'unknown';
}

export function failuresToParsedErrors(failures: AnalyzedTestFailure[]): ParsedError[] {
  return failures.map((f) => ({
    message:  f.message,
    severity: 'error' as const,
    category: 'test' as const,
    file:     f.file,
    raw:      f.message,
  }));
}

export function buildTestFailureSummary(failures: AnalyzedTestFailure[]): string {
  if (failures.length === 0) return 'All tests passed';
  const byKind = failures.reduce((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ');
}
