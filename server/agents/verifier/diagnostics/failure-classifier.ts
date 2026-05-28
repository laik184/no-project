/**
 * diagnostics/failure-classifier.ts
 * Classifies raw error strings into structured failures.
 * Called by server/tools/verifier/typecheck/type-error-classifier.ts and others.
 */

import type { ClassifiedFailure, FailureCategory, ErrorSeverity, ParsedError } from '../types/diagnostics.types.ts';

const CATEGORIES: Array<{ regex: RegExp; category: FailureCategory }> = [
  { regex: /error TS\d{4}/i,                          category: 'typecheck'   },
  { regex: /build failed|vite.*error/i,               category: 'build'       },
  { regex: /cannot find module|module not found/i,    category: 'dependency'  },
  { regex: /econnrefused|eaddrinuse|network/i,        category: 'network'     },
  { regex: /test.*fail|assertion.*error|expect/i,     category: 'test'        },
  { regex: /server.*crash|process.*exit|uncaught/i,   category: 'runtime'     },
  { regex: /tsconfig|package\.json|missing config/i,  category: 'config'      },
];

const SEVERITIES: Array<{ regex: RegExp; severity: ErrorSeverity }> = [
  { regex: /fatal|crash|oom/i,            severity: 'fatal'   },
  { regex: /\berror\b|\bfailed\b/i,       severity: 'error'   },
  { regex: /\bwarn(ing)?\b/i,             severity: 'warning' },
];

export function classifyError(message: string): ClassifiedFailure & ParsedError {
  let category: FailureCategory = 'unknown';
  for (const { regex, category: c } of CATEGORIES) {
    if (regex.test(message)) { category = c; break; }
  }

  let severity: ErrorSeverity = 'info';
  for (const { regex, severity: s } of SEVERITIES) {
    if (regex.test(message)) { severity = s; break; }
  }

  return { category, severity, message: message.slice(0, 300), raw: message };
}

export function classifyAll(messages: string[]): Array<ClassifiedFailure & ParsedError> {
  return messages.map(classifyError);
}

export function classifyTsErrors(output: string): ClassifiedFailure[] {
  return output
    .split('\n')
    .filter((l) => /error TS\d{4}/i.test(l))
    .map((l) => classifyError(l.trim()));
}
