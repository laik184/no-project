import type { ParsedError, FailureCategory, ErrorSeverity } from './verifier-types.ts';

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: FailureCategory }> = [
  { pattern: /TS\d{4}|TypeError:|type error/i,       category: 'type'        },
  { pattern: /build failed|webpack|vite|esbuild/i,   category: 'build'       },
  { pattern: /test failed|jest|vitest|mocha/i,        category: 'test'        },
  { pattern: /ENOENT|module not found|import error/i, category: 'dependency'  },
  { pattern: /EADDRINUSE|server crash|uncaught/i,     category: 'runtime'     },
];

function detectCategory(message: string): FailureCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(message)) return category;
  }
  return 'unknown';
}

function detectSeverity(message: string, exitCode?: number): ErrorSeverity {
  if (exitCode !== undefined && exitCode !== 0) return 'error';
  if (/^error:/i.test(message.trim()))  return 'error';
  if (/^warning:/i.test(message.trim())) return 'warning';
  if (/fatal|crash|uncaught/i.test(message)) return 'fatal';
  return 'error';
}

export function classifyError(error: ParsedError): ParsedError {
  return {
    ...error,
    category: error.category !== 'unknown' ? error.category : detectCategory(error.message),
    severity: error.severity ?? detectSeverity(error.message),
  };
}

export function classifyErrors(errors: ParsedError[]): ParsedError[] {
  return errors.map(classifyError);
}
