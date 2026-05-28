import type { ParsedError, RootCause, FailureCategory } from './verifier-types.ts';

const ACTIONABLE: Record<FailureCategory, string> = {
  build:      'Fix build errors — check missing imports and syntax',
  type:       'Fix TypeScript errors — run tsc --noEmit locally',
  test:       'Fix failing tests — review test output for assertions',
  runtime:    'Fix runtime crash — review server logs and port conflicts',
  dependency: 'Install missing packages — run npm install',
  unknown:    'Review error output and fix underlying issue',
};

export function detectRootCauses(errors: ParsedError[]): RootCause[] {
  const groups = new Map<FailureCategory, ParsedError[]>();
  for (const e of errors) {
    const cat = e.category ?? 'unknown';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(e);
  }
  const causes: RootCause[] = [];
  for (const [category, errs] of groups) {
    const descriptions = [...new Set(errs.map((e) => e.message))].slice(0, 3);
    causes.push({
      category,
      description: descriptions.join('; '),
      errors:      errs,
      actionable:  ACTIONABLE[category] ?? ACTIONABLE.unknown,
    });
  }
  return causes.sort((a, b) => b.errors.length - a.errors.length);
}

export function primaryRootCause(errors: ParsedError[]): RootCause | undefined {
  const causes = detectRootCauses(errors);
  return causes[0];
}
