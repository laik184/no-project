import { randomUUID } from 'crypto';
import type { OrchestrationPhase, TaskPriority } from '../events/event-types.ts';

/** Generate a unique run ID with an optional prefix. */
export function generateRunId(prefix = 'run'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/** Generate a unique task ID. */
export function generateTaskId(type: string): string {
  return `task_${type}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

/** Format a duration in milliseconds to a human-readable string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/** Determine if the elapsed time exceeds a timeout threshold. */
export function isTimedOut(startedAt: Date, timeoutMs: number): boolean {
  return Date.now() - startedAt.getTime() > timeoutMs;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Determine numeric priority weight for sorting. Higher = more urgent. */
export function priorityWeight(priority: TaskPriority): number {
  const weights: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  return weights[priority] ?? 2;
}

/** Map a phase to a display-friendly label. */
export function phaseLabel(phase: OrchestrationPhase): string {
  const labels: Record<OrchestrationPhase, string> = {
    analyze: 'Analyzing Goal',
    planning: 'Planning Tasks',
    execution: 'Executing Code',
    verification: 'Verifying Build',
    browser: 'Browser Check',
    complete: 'Complete',
    failed: 'Failed',
  };
  return labels[phase] ?? phase;
}

/** Safely serialize any value to JSON string for logging. */
export function safeJsonStringify(value: unknown, indent = 0): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

/** Truncate a string to the given length, appending '...' if cut. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/** Deep-clone a plain object via JSON round-trip. */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/** Return the current ISO timestamp string. */
export function now(): string {
  return new Date().toISOString();
}

/** Build a structured log prefix for a run. */
export function runTag(runId: string, phase?: OrchestrationPhase): string {
  return phase ? `[${runId}][${phase}]` : `[${runId}]`;
}

/** Return elapsed ms since a given Date. */
export function elapsed(since: Date): number {
  return Date.now() - since.getTime();
}
