/**
 * build/build-error-parser.ts
 * Parses raw build output into structured ParsedError objects.
 * Called by server/tools/verifier/build/build-error-classifier.ts.
 */

import type { ParsedError } from '../types/diagnostics.types.ts';

const ERROR_PATTERNS: Array<{
  regex: RegExp;
  category: ParsedError['category'];
}> = [
  { regex: /error TS\d{4}/i,                         category: 'typecheck'   },
  { regex: /vite.*build.*error|esbuild.*error/i,     category: 'build'       },
  { regex: /cannot find module|module not found/i,   category: 'dependency'  },
  { regex: /syntax.*error|unexpected token/i,        category: 'build'       },
];

const SEVERITY_RE: Record<ParsedError['severity'], RegExp> = {
  fatal:   /fatal|crash|oom/i,
  error:   /\berror\b|\bfailed\b/i,
  warning: /\bwarn(ing)?\b/i,
  info:    /.*/,
};

function detectCategory(line: string): ParsedError['category'] {
  for (const { regex, category } of ERROR_PATTERNS) {
    if (regex.test(line)) return category;
  }
  return 'build';
}

function detectSeverity(line: string): ParsedError['severity'] {
  for (const [severity, re] of Object.entries(SEVERITY_RE) as [ParsedError['severity'], RegExp][]) {
    if (re.test(line)) return severity;
  }
  return 'info';
}

export function parseBuildErrors(output: string): ParsedError[] {
  const lines  = output.split('\n');
  const errors: ParsedError[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!/error|fail|warn/i.test(trimmed)) continue;

    errors.push({
      message:  trimmed.slice(0, 400),
      severity: detectSeverity(trimmed),
      category: detectCategory(trimmed),
      raw:      trimmed,
    });
  }

  return errors;
}
