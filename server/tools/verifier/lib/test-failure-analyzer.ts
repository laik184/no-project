import type { ParsedError }    from './verifier-types.ts';
import type { ParsedTestResults } from './test-result-parser.ts';

export interface TestFailure {
  name:     string;
  message:  string;
  category: string;
}

export function analyzeTestFailures(parsed: ParsedTestResults): TestFailure[] {
  return parsed.failures.map((f) => ({
    name:     f.name,
    message:  f.message,
    category: categorizeFail(f.message),
  }));
}

function categorizeFail(msg: string): string {
  if (/timeout/i.test(msg))              return 'timeout';
  if (/assertion|expect|assert/i.test(msg)) return 'assertion';
  if (/undefined|null|TypeError/i.test(msg)) return 'type_error';
  if (/network|fetch|http/i.test(msg))   return 'network';
  return 'unknown';
}

export function failuresToParsedErrors(failures: TestFailure[]): ParsedError[] {
  return failures.map((f) => ({
    message:  f.message,
    severity: 'error' as const,
    category: 'test' as const,
    code:     f.category,
  }));
}
