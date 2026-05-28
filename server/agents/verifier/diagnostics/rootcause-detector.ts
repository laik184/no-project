/**
 * server/agents/verifier/diagnostics/rootcause-detector.ts
 * Detects root causes from verification step failures.
 */

import type { VerificationStepResult, VerificationPhase } from '../types/verifier.types.ts';

export interface VerificationRootCause {
  phase:       VerificationPhase;
  category:    string;
  description: string;
  actionable:  string;
  errors:      string[];
}

const PHASE_ACTIONABLE: Record<VerificationPhase, string> = {
  build:       'Fix build errors — check package.json scripts and dependencies',
  typecheck:   'Fix TypeScript errors — run `tsc --noEmit` locally',
  tests:       'Fix failing tests — review test assertions and mocks',
  runtime:     'Server is not starting — check startup command and port config',
  endpoints:   'HTTP endpoints returning wrong status — review route handlers',
  dependencies: 'Dependencies missing — run `npm install`',
  validation:  'Validation failed — check input format and schema',
  recovery:    'Recovery system error — check retry configuration',
  diagnostics: 'Diagnostics failed — check error parsing configuration',
};

export function detectVerificationRootCauses(results: VerificationStepResult[]): VerificationRootCause[] {
  const failedByPhase = new Map<VerificationPhase, VerificationStepResult[]>();

  for (const r of results.filter((r) => !r.success)) {
    const arr = failedByPhase.get(r.phase) ?? [];
    arr.push(r);
    failedByPhase.set(r.phase, arr);
  }

  const causes: VerificationRootCause[] = [];
  for (const [phase, stepResults] of failedByPhase) {
    const errors = stepResults.map((r) => r.error ?? 'Unknown error').filter(Boolean);
    causes.push({
      phase,
      category:    phase,
      description: errors.slice(0, 3).join('; '),
      actionable:  PHASE_ACTIONABLE[phase] ?? 'Review logs and fix the underlying issue',
      errors,
    });
  }

  return causes.sort((a, b) => {
    const order: VerificationPhase[] = ['dependencies', 'typecheck', 'build', 'tests', 'runtime', 'endpoints'];
    return order.indexOf(a.phase) - order.indexOf(b.phase);
  });
}

export function primaryRootCause(results: VerificationStepResult[]): VerificationRootCause | undefined {
  return detectVerificationRootCauses(results)[0];
}
