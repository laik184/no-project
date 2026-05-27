import type { StackFrame, ParsedError, ErrorSeverity } from '../types/diagnostics.types.ts';

export function formatStackTrace(frames: StackFrame[]): string {
  return frames
    .map((f) => {
      const loc = f.column !== undefined ? `${f.line}:${f.column}` : `${f.line}`;
      const fn  = f.functionName ? `${f.functionName} ` : '';
      return `  at ${fn}(${f.file}:${loc})`;
    })
    .join('\n');
}

export function buildErrorContext(
  error:    ParsedError,
  maxLines  = 5,
): string {
  const lines: string[] = [
    `[${error.severity.toUpperCase()}] ${error.message}`,
  ];
  if (error.file) {
    const loc = error.line !== undefined ? `:${error.line}` : '';
    lines.push(`  File: ${error.file}${loc}`);
  }
  if (error.code) lines.push(`  Code: ${error.code}`);
  return lines.slice(0, maxLines).join('\n');
}

export function summarizeErrors(errors: ParsedError[]): string {
  const fatal   = errors.filter((e) => e.severity === 'fatal').length;
  const errs    = errors.filter((e) => e.severity === 'error').length;
  const warns   = errors.filter((e) => e.severity === 'warning').length;
  const parts: string[] = [];
  if (fatal > 0) parts.push(`${fatal} fatal`);
  if (errs  > 0) parts.push(`${errs} error(s)`);
  if (warns > 0) parts.push(`${warns} warning(s)`);
  return parts.length ? parts.join(', ') : 'no issues';
}

export function highestSeverity(errors: ParsedError[]): ErrorSeverity {
  if (errors.some((e) => e.severity === 'fatal'))   return 'fatal';
  if (errors.some((e) => e.severity === 'error'))   return 'error';
  if (errors.some((e) => e.severity === 'warning')) return 'warning';
  return 'info';
}

export function deduplicateErrors(errors: ParsedError[]): ParsedError[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.category}:${e.message}:${e.file ?? ''}:${e.line ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
