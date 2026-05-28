/**
 * server/agents/planner/utils/planning-utils.ts
 *
 * Pure utility functions for the planner agent orchestration layer.
 * No side effects. No tool calls. No direct execution.
 */

import { randomUUID } from 'crypto';
import type { RecoveryAction, PlanningTaskOutcome } from '../types/planner.types.ts';

/** Generate a unique planning run ID. */
export function makeRunId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

/** Generate a unique plan ID. */
export function makePlanId(): string {
  return `plan-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generate a unique task ID with a prefix. */
export function makeTaskId(prefix = 'task'): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

/** Milliseconds elapsed since a timestamp. */
export function elapsedMs(since: number): number {
  return Date.now() - since;
}

/** Exponential backoff delay in ms, capped at maxMs. */
export function backoffMs(attempt: number, baseMs = 500, maxMs = 10_000): number {
  return Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
}

/** Sleep for n milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify a planning error string into a recovery action.
 * Pure function — no I/O, no side effects.
 */
export function decideRecovery(error: string): RecoveryAction {
  if (/permission|EACCES|EPERM|unauthorized/i.test(error))  return 'abort';
  if (/timeout|ETIMEDOUT|ESRCH/i.test(error))               return 'skip';
  if (/not found|ENOENT|MODULE_NOT_FOUND/i.test(error))     return 'skip';
  if (/cycle|circular|escalat|critical|fatal/i.test(error)) return 'escalate';
  return 'retry';
}

/** Compute the failure rate from a set of planning outcomes. */
export function failureRate(outcomes: readonly PlanningTaskOutcome[]): number {
  if (outcomes.length === 0) return 0;
  return outcomes.filter((o) => !o.success).length / outcomes.length;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Truncate a string to maxLen, appending '…' if cut. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/** Build a safe single-line label (no newlines, max 120 chars). */
export function safeLabel(label: string): string {
  return truncate(label.replace(/[\r\n]+/g, ' '), 120);
}

/** Topological sort of tasks by dependency order. Returns sorted IDs. */
export function topoSort(
  tasks: ReadonlyArray<{ id: string; dependencies: string[] }>,
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const task = tasks.find((t) => t.id === id);
    if (task) {
      for (const dep of task.dependencies) visit(dep);
    }
    order.push(id);
  }

  for (const task of tasks) visit(task.id);
  return order;
}

/** Normalise a goal string: trim whitespace, collapse runs. */
export function normaliseGoal(goal: string): string {
  return goal.trim().replace(/\s+/g, ' ');
}

/** Estimate planning duration in ms based on phase count and task count. */
export function estimateDurationMs(phaseCount: number, taskCount: number): number {
  return phaseCount * 2_000 + taskCount * 500;
}
