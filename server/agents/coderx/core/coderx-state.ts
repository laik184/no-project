/**
 * server/agents/coderx/core/coderx-state.ts
 *
 * Manages the in-flight step registry for a single CoderX run.
 * Tracks status transitions and provides a consistent state view.
 * No execution logic — pure in-process state management.
 */

import type { RuntimeCodingStep, CodingStep, CodingStepStatus } from '../types/coderx.types.ts';
import { now } from '../utils/coding-utils.ts';

const _steps = new Map<string, RuntimeCodingStep>();

export function registerStep(step: CodingStep): RuntimeCodingStep {
  const rs: RuntimeCodingStep = { step, status: 'pending', retryCount: 0 };
  _steps.set(step.stepId, rs);
  return rs;
}

export function markRunning(stepId: string): void {
  const s = _steps.get(stepId);
  if (!s) return;
  s.status    = 'running';
  s.startedAt = now();
}

export function markRetrying(stepId: string): void {
  const s = _steps.get(stepId);
  if (!s) return;
  s.status = 'retrying';
  s.retryCount++;
}

export function markCompleted(stepId: string, output: unknown): void {
  const s = _steps.get(stepId);
  if (!s) return;
  s.status      = 'completed';
  s.completedAt = now();
  s.output      = output;
}

export function markFailed(stepId: string, error: string): void {
  const s = _steps.get(stepId);
  if (!s) return;
  s.status      = 'failed';
  s.completedAt = now();
  s.error       = error;
}

export function markSkipped(stepId: string): void {
  const s = _steps.get(stepId);
  if (!s) return;
  s.status      = 'skipped';
  s.completedAt = now();
}

export function getStep(stepId: string): RuntimeCodingStep | undefined {
  return _steps.get(stepId);
}

export function listByStatus(status: CodingStepStatus): RuntimeCodingStep[] {
  return [..._steps.values()].filter((s) => s.status === status);
}

export function allSteps(): RuntimeCodingStep[] {
  return [..._steps.values()];
}

export function removeStep(stepId: string): void {
  _steps.delete(stepId);
}

export function resetState(): void {
  _steps.clear();
}
