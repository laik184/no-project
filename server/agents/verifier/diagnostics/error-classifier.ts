/**
 * diagnostics/error-classifier.ts
 * Classifies error strings into typed failure categories.
 * Orchestration-only — no tool calls.
 */

import type { FailureCategory, ErrorSeverity, ParsedError, ClassifiedFailure } from '../types/diagnostics.types.ts';

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: FailureCategory }> = [
  { pattern: /ts\d{4}|type error|cannot find name|type '.*' is not/i, category: 'typecheck'   },
  { pattern: /build failed|vite.*error|esbuild|webpack/i,             category: 'build'       },
  { pattern: /cannot find module|enoent|eacces|connection refused/i,  category: 'runtime'     },
  { pattern: /test.*fail|assertion.*fail|expect.*received/i,          category: 'test'        },
  { pattern: /fetch.*failed|network.*error|socket.*hang/i,            category: 'network'     },
  { pattern: /env.*missing|config.*invalid|missing.*secret|\.env/i,   category: 'config'      },
  { pattern: /package.*not.*found|npm.*err|yarn.*error/i,             category: 'dependency'  },
];

const SEVERITY_PATTERNS: Array<{ pattern: RegExp; severity: ErrorSeverity }> = [
  { pattern: /fatal|crash|segfault|oom|out of memory/i, severity: 'fatal'   },
  { pattern: /error|failed|exception|invalid/i,          severity: 'error'   },
  { pattern: /warn|deprecated|obsolete/i,                severity: 'warning' },
];

export function classifyCategory(message: string): FailureCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(message)) return category;
  }
  return 'unknown';
}

export function classifySeverity(message: string): ErrorSeverity {
  for (const { pattern, severity } of SEVERITY_PATTERNS) {
    if (pattern.test(message)) return severity;
  }
  return 'info';
}

export function classifyError(raw: string, file?: string): ParsedError {
  return {
    message:  raw.trim().slice(0, 500),
    severity: classifySeverity(raw),
    category: classifyCategory(raw),
    file,
    raw,
  };
}

export function classifyAll(messages: string[]): ClassifiedFailure[] {
  return messages.map((msg) => ({
    category:   classifyCategory(msg),
    severity:   classifySeverity(msg),
    message:    msg.trim().slice(0, 300),
  }));
}

export function groupByCategory(errors: ParsedError[]): Partial<Record<FailureCategory, ParsedError[]>> {
  const groups: Partial<Record<FailureCategory, ParsedError[]>> = {};
  for (const e of errors) {
    if (!groups[e.category]) groups[e.category] = [];
    groups[e.category]!.push(e);
  }
  return groups;
}

export function topCategory(errors: ParsedError[]): FailureCategory {
  const groups = groupByCategory(errors);
  return Object.entries(groups)
    .sort(([, a], [, b]) => (b?.length ?? 0) - (a?.length ?? 0))[0]?.[0] as FailureCategory ?? 'unknown';
}
