import type { FailureCategory, ParsedError, ErrorSeverity } from '../types/diagnostics.types.ts';

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: FailureCategory }> = [
  { pattern: /ts\d{4}|type error|cannot find name|type '.*' is not/i,         category: 'typecheck' },
  { pattern: /build failed|webpack|vite.*error|esbuild/i,                      category: 'build'     },
  { pattern: /cannot find module|enoent|eacces|connection refused/i,           category: 'runtime'   },
  { pattern: /test.*fail|assertion.*fail|expect.*received/i,                   category: 'test'      },
  { pattern: /fetch.*failed|network.*error|socket.*hang/i,                     category: 'network'   },
  { pattern: /env.*missing|config.*invalid|missing.*secret|\.env/i,            category: 'config'    },
];

const SEVERITY_MAP: Array<{ pattern: RegExp; severity: ErrorSeverity }> = [
  { pattern: /fatal|crash|segfault|oom|out of memory/i, severity: 'fatal'   },
  { pattern: /error|failed|exception|invalid/i,          severity: 'error'   },
  { pattern: /warn|deprecated|obsolete/i,                severity: 'warning' },
];

export function classifyFailure(message: string): FailureCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(message)) return category;
  }
  return 'unknown';
}

export function classifySeverity(message: string): ErrorSeverity {
  for (const { pattern, severity } of SEVERITY_MAP) {
    if (pattern.test(message)) return severity;
  }
  return 'info';
}

export function classifyError(raw: string, file?: string): ParsedError {
  return {
    message:  raw.trim().slice(0, 500),
    severity: classifySeverity(raw),
    category: classifyFailure(raw),
    file,
    raw,
  };
}

export function groupByCategory(errors: ParsedError[]): Record<FailureCategory, ParsedError[]> {
  const groups = {} as Record<FailureCategory, ParsedError[]>;
  for (const e of errors) {
    if (!groups[e.category]) groups[e.category] = [];
    groups[e.category].push(e);
  }
  return groups;
}
