/**
 * testing/test-failure-analyzer.ts
 * Classifies test failures by type and converts to ParsedError objects.
 * Called by server/tools/verifier/tests/test-failure-classifier.ts.
 */

import type { ParsedError } from '../types/diagnostics.types.ts';

export type TestFailureCategory = 'assertion' | 'timeout' | 'crash' | 'not_found' | 'setup' | 'unknown';

export interface TestFailure {
  name:      string;
  category:  TestFailureCategory;
  message:   string;
  stack?:    string;
}

export interface TestFailureAnalysis {
  total:      number;
  categories: Record<TestFailureCategory, number>;
  failures:   TestFailure[];
  summary:    string;
}

function classifyMessage(msg: string): TestFailureCategory {
  if (/timeout|timed? ?out/i.test(msg))                 return 'timeout';
  if (/assertion|expected|to equal|not to be/i.test(msg)) return 'assertion';
  if (/cannot find|not found|missing/i.test(msg))        return 'not_found';
  if (/setup|before|after|hook/i.test(msg))              return 'setup';
  if (/crash|uncaught|unhandled/i.test(msg))             return 'crash';
  return 'unknown';
}

export function analyzeTestFailures(
  rawOutputOrParsed: string | { suites?: unknown[]; passed?: number; failed?: number; skipped?: number },
): TestFailureAnalysis {
  const rawOutput = typeof rawOutputOrParsed === 'string' ? rawOutputOrParsed : JSON.stringify(rawOutputOrParsed);
  const lines     = rawOutput.split('\n');
  const failures: TestFailure[] = [];
  const categories: Record<TestFailureCategory, number> = {
    assertion: 0, timeout: 0, crash: 0, not_found: 0, setup: 0, unknown: 0,
  };

  let currentName = '';
  let currentMsg  = '';

  for (const line of lines) {
    const nameMatch = /^\s*\d+\)\s+(.+)/.exec(line);
    if (nameMatch) {
      if (currentName && currentMsg) {
        const category = classifyMessage(currentMsg);
        failures.push({ name: currentName, category, message: currentMsg });
        categories[category]++;
      }
      currentName = nameMatch[1];
      currentMsg  = '';
      continue;
    }
    if (currentName && /AssertionError|Error:|expected|actual/i.test(line)) {
      currentMsg = currentMsg || line.trim();
    }
  }

  if (currentName && currentMsg) {
    const category = classifyMessage(currentMsg);
    failures.push({ name: currentName, category, message: currentMsg });
    categories[category]++;
  }

  const total   = failures.length;
  return { total, categories, failures, summary: total === 0 ? 'No failures' : `${total} failure(s)` };
}

export function failuresToParsedErrors(analysis: TestFailureAnalysis): ParsedError[] {
  return analysis.failures.map((f) => ({
    message:  f.message,
    severity: 'error',
    category: 'test',
    raw:      f.message,
  }));
}
