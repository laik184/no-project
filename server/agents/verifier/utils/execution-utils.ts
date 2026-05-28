/**
 * utils/execution-utils.ts
 * Utility functions for execution coordination.
 */

import type { StepResult, ExecutionSummary } from '../types/execution.types.ts';

export function allPassed(results: StepResult[]): boolean {
  return results.every((r) => r.passed || !r.status.includes('failed'));
}

export function requiredStepsFailed(results: StepResult[]): StepResult[] {
  return results.filter((r) => !r.passed);
}

export function buildExecutionSummary(
  runId:   string,
  results: StepResult[],
  durationMs: number,
): ExecutionSummary {
  return {
    runId,
    total:   results.length,
    passed:  results.filter((r) => r.passed).length,
    failed:  results.filter((r) => !r.passed).length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    durationMs,
    steps:   results,
  };
}

export function collectStepErrors(results: StepResult[]): string[] {
  return results.flatMap((r) => r.errors);
}

export function collectStepWarnings(results: StepResult[]): string[] {
  return results.flatMap((r) => r.warnings);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout<T>(
  fn:         () => Promise<T>,
  timeoutMs:  number,
  label:      string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[verifier] Timeout after ${timeoutMs}ms: ${label}`)),
      timeoutMs,
    );
    fn()
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

export function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return '[unknown error]'; }
}

export function makeStepResult(
  stepId:     string,
  toolName:   string,
  passed:     boolean,
  durationMs: number,
  opts:       { errors?: string[]; warnings?: string[]; data?: unknown; attempts?: number } = {},
): StepResult {
  return {
    stepId,
    toolName,
    status:     passed ? 'passed' : 'failed',
    passed,
    durationMs,
    attempts:   opts.attempts  ?? 1,
    errors:     opts.errors    ?? [],
    warnings:   opts.warnings  ?? [],
    data:       opts.data,
  };
}
