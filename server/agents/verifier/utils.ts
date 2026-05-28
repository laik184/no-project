import type { StackFrame, ParsedError, ErrorSeverity } from './types.ts';

export function parseLines(output: string): string[] {
  return output.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

export function extractSection(output: string, startMark: string, endMark: string): string {
  const start = output.indexOf(startMark);
  if (start === -1) return '';
  const end = output.indexOf(endMark, start + startMark.length);
  return end === -1
    ? output.slice(start + startMark.length).trim()
    : output.slice(start + startMark.length, end).trim();
}

export function splitOutput(output: string, delimiter = '\n\n'): string[] {
  return output.split(delimiter).map((s) => s.trim()).filter(Boolean);
}

export function extractNumber(text: string, pattern: RegExp): number | undefined {
  const m = text.match(pattern);
  return m ? parseInt(m[1], 10) : undefined;
}

export function extractGroup(text: string, pattern: RegExp, group = 1): string | undefined {
  const m = text.match(pattern);
  return m ? m[group] : undefined;
}

export function matchAll(text: string, pattern: RegExp): RegExpMatchArray[] {
  return Array.from(text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')));
}

export function lastLines(output: string, n: number): string[] {
  return parseLines(output).slice(-n);
}

export function firstLines(output: string, n: number): string[] {
  return parseLines(output).slice(0, n);
}

export function formatStackTrace(frames: StackFrame[]): string {
  return frames
    .map((f) => {
      const loc = f.column !== undefined ? `${f.line}:${f.column}` : `${f.line}`;
      const fn  = f.functionName ? `${f.functionName} ` : '';
      return `  at ${fn}(${f.file}:${loc})`;
    })
    .join('\n');
}

export function buildErrorContext(error: ParsedError, maxLines = 5): string {
  const lines: string[] = [`[${error.severity.toUpperCase()}] ${error.message}`];
  if (error.file) {
    const loc = error.line !== undefined ? `:${error.line}` : '';
    lines.push(`  File: ${error.file}${loc}`);
  }
  if (error.code) lines.push(`  Code: ${error.code}`);
  return lines.slice(0, maxLines).join('\n');
}

export function summarizeErrors(errors: ParsedError[]): string {
  const fatal = errors.filter((e) => e.severity === 'fatal').length;
  const errs  = errors.filter((e) => e.severity === 'error').length;
  const warns = errors.filter((e) => e.severity === 'warning').length;
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

export function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  try { return new Error(JSON.stringify(err)); }
  catch { return new Error('[unserializable error]'); }
}

export function extractMessage(err: unknown): string {
  return normalizeError(err).message;
}

export function isNodeError(err: unknown, code: string): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === code
  );
}

export function limitLength(text: string, maxChars = 2000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n... [truncated ${text.length - maxChars} chars]`;
}

export function collectErrors(results: Array<{ errors: string[] }>): string[] {
  return results.flatMap((r) => r.errors);
}

export function collectWarnings(results: Array<{ warnings: string[] }>): string[] {
  return results.flatMap((r) => r.warnings ?? []);
}

export function assertDefined<T>(value: T | undefined | null, label: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`[verifier] Required value missing: ${label}`);
  }
}

export function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isSuccessExitCode(code: number): boolean {
  return code === 0;
}
