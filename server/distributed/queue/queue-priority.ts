/**
 * Responsibility: Priority mapping between internal TaskPriorityLevel and
 *                 BullMQ numeric priorities. Lower number = higher priority in BullMQ.
 * Dependencies: none
 * Failure: unknown priorities map to NORMAL (3); never throws.
 * Telemetry: none — pure mapping.
 */

import type { TaskPriorityLevel } from "./priority-queue.ts";

export const BULLMQ_PRIORITY: Record<TaskPriorityLevel, number> = {
  critical:   1,
  high:       2,
  normal:     3,
  low:        4,
  background: 5,
};

export function toBullMQPriority(level: TaskPriorityLevel): number {
  return BULLMQ_PRIORITY[level] ?? 3;
}

export function fromBullMQPriority(numeric: number): TaskPriorityLevel {
  const entries = Object.entries(BULLMQ_PRIORITY) as [TaskPriorityLevel, number][];
  return entries.find(([, v]) => v === numeric)?.[0] ?? "normal";
}

/** Score for internal priority queue (higher = more urgent). */
export function toInternalScore(level: TaskPriorityLevel): number {
  const inverse: Record<TaskPriorityLevel, number> = {
    critical: 100, high: 75, normal: 50, low: 25, background: 10,
  };
  return inverse[level] ?? 50;
}
