/**
 * server/agents/verifier/validation/verification-validator.ts
 * Validates incoming VerifierInput requests.
 */

import type { VerifierInput, VerifierValidationResult, VerificationPhase } from '../types/verifier.types.ts';

const VALID_PHASES: VerificationPhase[] = [
  'build', 'typecheck', 'tests', 'runtime', 'endpoints',
  'dependencies', 'validation', 'recovery', 'diagnostics',
];

export function validateVerifierInput(input: unknown): VerifierValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Input must be a non-null object'], warnings };
  }

  const req = input as Record<string, unknown>;

  if (!req.runId || typeof req.runId !== 'string' || req.runId.trim().length === 0) {
    errors.push('runId is required and must be a non-empty string');
  }

  if (!req.projectId || typeof req.projectId !== 'string' || req.projectId.trim().length === 0) {
    errors.push('projectId is required and must be a non-empty string');
  }

  if (req.phases !== undefined) {
    if (!Array.isArray(req.phases)) {
      errors.push('phases must be an array');
    } else {
      const invalid = (req.phases as string[]).filter((p) => !VALID_PHASES.includes(p as VerificationPhase));
      if (invalid.length > 0) {
        warnings.push(`Unknown phases will be skipped: ${invalid.join(', ')}`);
      }
    }
  }

  if (req.timeoutMs !== undefined) {
    const t = Number(req.timeoutMs);
    if (Number.isNaN(t) || t < 1000) warnings.push('timeoutMs below 1000ms — using default');
    if (t > 600_000) warnings.push('timeoutMs above 10 minutes — may stall pipeline');
  }

  return { valid: errors.length === 0, errors, warnings };
}
