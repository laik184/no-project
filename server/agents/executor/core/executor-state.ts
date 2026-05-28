/**
 * server/agents/executor/core/executor-state.ts
 *
 * Manages the in-flight step registry for a single agent run.
 * Tracks status transitions and provides a consistent state view.
 * No execution logic — pure in-process state management.
 */

import type {
  RuntimeStep,
  ExecutionStep,
  ExecutionStepStatus,
} from '../types/executor.types.ts';
import { now } from '../utils/execution-utils.ts';

const _steps = new Map<string, RuntimeStep>();

export function registerStep(step: ExecutionStep): RuntimeStep {
  const rs: RuntimeStep = { step, status: 'pending', retryCount: 0 };
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

export function getStep(stepId: string): RuntimeStep | undefined {
  return _steps.get(stepId);
}

export function listByStatus(status: ExecutionStepStatus): RuntimeStep[] {
  return [..._steps.values()].filter((s) => s.status === status);
}

export function allSteps(): RuntimeStep[] {
  return [..._steps.values()];
}

export function removeStep(stepId: string): void {
  _steps.delete(stepId);
}

export function resetState(): void {
  _steps.clear();
}
