/**
 * utils/diagnostics-utils.ts
 * Utility functions for working with diagnostics data.
 */

import type { ParsedError, ErrorSeverity, FailureCategory, FailureSummary } from '../types/diagnostics.types.ts';

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

export function buildFailureSummary(errors: ParsedError[]): FailureSummary {
  const fatal    = errors.filter((e) => e.severity === 'fatal').length;
  const errs     = errors.filter((e) => e.severity === 'error').length;
  const warns    = errors.filter((e) => e.severity === 'warning').length;
  const topErrors = errors.slice(0, 5).map((e) => e.message);

  const categories: Partial<Record<FailureCategory, number>> = {};
  for (const e of errors) {
    categories[e.category] = (categories[e.category] ?? 0) + 1;
  }

  return {
    total:       errors.length,
    fatal,
    errors:      errs,
    warnings:    warns,
    categories,
    topErrors,
    hasCritical: fatal > 0 || errs > 0,
  };
}

export function errorMessagesToStrings(errors: ParsedError[]): string[] {
  return errors.map((e) => {
    const loc  = e.file ? ` [${e.file}${e.line !== undefined ? `:${e.line}` : ''}]` : '';
    const code = e.code ? ` (${e.code})` : '';
    return `${e.message}${code}${loc}`;
  });
}

export function filterByCategory(
  errors:   ParsedError[],
  category: FailureCategory,
): ParsedError[] {
  return errors.filter((e) => e.category === category);
}

export function filterBySeverity(
  errors:   ParsedError[],
  severity: ErrorSeverity,
): ParsedError[] {
  return errors.filter((e) => e.severity === severity);
}

export function isCriticalFailure(errors: ParsedError[]): boolean {
  return errors.some((e) => e.severity === 'fatal' || e.severity === 'error');
}
