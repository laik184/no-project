/**
 * Responsibility: Priority routing for worker tasks — maps task priority levels
 *                 to worker tiers and determines scheduling order.
 * Dependencies: none
 * Failure: unknown priorities route to "io-bound" (safe fallback); never throws.
 * Telemetry: none — pure routing logic.
 */

import type { WorkerTier } from "./types/index.ts";

export type TaskPriority = "critical" | "high" | "normal" | "low" | "background";

/** Map a logical task priority to the appropriate worker tier. */
export function priorityToTier(priority: TaskPriority): WorkerTier {
  const map: Record<TaskPriority, WorkerTier> = {
    critical:   "llm",
    high:       "cpu-bound",
    normal:     "io-bound",
    low:        "io-bound",
    background: "io-bound",
  };
  return map[priority] ?? "io-bound";
}

/** Numeric weight for priority queue ordering (higher = more urgent). */
export function priorityWeight(priority: TaskPriority): number {
  const weights: Record<TaskPriority, number> = {
    critical: 100, high: 75, normal: 50, low: 25, background: 10,
  };
  return weights[priority] ?? 50;
}

/** Timeout per priority tier (ms). */
export function priorityTimeout(priority: TaskPriority): number {
  const timeouts: Record<TaskPriority, number> = {
    critical:   120_000,
    high:        60_000,
    normal:      30_000,
    low:         15_000,
    background:  10_000,
  };
  return timeouts[priority] ?? 30_000;
}
