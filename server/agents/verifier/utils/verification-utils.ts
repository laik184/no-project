/**
 * utils/verification-utils.ts
 * Pure utility functions for verification orchestration.
 */

import type { VerificationPhase, VerificationStatus, PhaseResult } from '../types/verifier.types.ts';

export function phasesPassed(results: PhaseResult[]): boolean {
  return results.every((r) => r.status === 'passed' || r.status === 'skipped');
}

export function countErrors(results: PhaseResult[]): number {
  return results.reduce((n, r) => n + r.errors.length, 0);
}

export function countWarnings(results: PhaseResult[]): number {
  return results.reduce((n, r) => n + r.warnings.length, 0);
}

export function failedPhases(results: PhaseResult[]): VerificationPhase[] {
  return results.filter((r) => r.status === 'failed').map((r) => r.phase);
}

export function pickStatus(results: PhaseResult[]): VerificationStatus {
  if (results.some((r) => r.status === 'failed'))   return 'failed';
  if (results.some((r) => r.status === 'running'))  return 'running';
  if (results.some((r) => r.status === 'skipped'))  return 'passed';
  if (results.every((r) => r.status === 'passed'))  return 'passed';
  return 'pending';
}

export function buildPhaseResult(
  phase:      VerificationPhase,
  passed:     boolean,
  durationMs: number,
  errors:     string[] = [],
  warnings:   string[] = [],
  output?:    string,
  metadata?:  Record<string, unknown>,
): PhaseResult {
  return { phase, status: passed ? 'passed' : 'failed', durationMs, errors, warnings, output, metadata };
}

export function skippedPhaseResult(phase: VerificationPhase): PhaseResult {
  return { phase, status: 'skipped', durationMs: 0, errors: [], warnings: [] };
}

export function isTerminalStatus(status: VerificationStatus): boolean {
  return status === 'passed' || status === 'failed' || status === 'cancelled';
}

export function summarizePhases(results: PhaseResult[]): string {
  const failed  = failedPhases(results);
  const total   = results.length;
  const passed  = results.filter((r) => r.status === 'passed').length;
  if (failed.length === 0) return `All ${total} phase(s) passed`;
  return `${passed}/${total} passed — failed: ${failed.join(', ')}`;
}

export function elapsedMs(startedAt: Date): number {
  return Date.now() - startedAt.getTime();
}
