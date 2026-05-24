/**
 * server/engine/swarm/swarm-priority-router.ts
 *
 * Priority scoring and backpressure routing for swarm tasks.
 * Maps SwarmTaskPriority → worker-pool tiers and slots.
 * Single responsibility: admission control and priority assignment only.
 */

import type { SwarmTaskNode, SwarmTaskPriority } from "./swarm-types.ts";

// ── Priority → worker tier mapping ────────────────────────────────────────────

export type WorkerTier = "critical" | "normal" | "low";

const PRIORITY_TO_TIER: Record<SwarmTaskPriority, WorkerTier> = {
  critical: "critical",
  high:     "critical",
  normal:   "normal",
  low:      "low",
};

// ── Timeout multipliers per tier ──────────────────────────────────────────────

const TIER_TIMEOUT_MULTIPLIER: Record<WorkerTier, number> = {
  critical: 1.0,
  normal:   1.5,
  low:      2.0,
};

// ── Concurrent slot limits per tier ──────────────────────────────────────────

const MAX_CONCURRENT: Record<WorkerTier, number> = {
  critical: 4,
  normal:   3,
  low:      2,
};

// ── In-flight tracker ─────────────────────────────────────────────────────────

const _inFlight = new Map<WorkerTier, Set<string>>();

function getSlots(tier: WorkerTier): Set<string> {
  if (!_inFlight.has(tier)) _inFlight.set(tier, new Set());
  return _inFlight.get(tier)!;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RoutingDecision {
  allowed:    boolean;
  tier:       WorkerTier;
  timeoutMs:  number;
  reason?:    string;
}

/**
 * Evaluate whether a task can be admitted now.
 * Enforces per-tier concurrent slot limits (backpressure).
 */
export function routeTask(task: SwarmTaskNode): RoutingDecision {
  const tier      = PRIORITY_TO_TIER[task.priority];
  const slots     = getSlots(tier);
  const max       = MAX_CONCURRENT[tier];
  const timeoutMs = Math.round(task.timeoutMs * TIER_TIMEOUT_MULTIPLIER[tier]);

  if (slots.size >= max) {
    return {
      allowed:   false,
      tier,
      timeoutMs,
      reason: `Tier ${tier} at capacity (${slots.size}/${max})`,
    };
  }

  slots.add(task.taskId);
  return { allowed: true, tier, timeoutMs };
}

/** Release a slot when a task completes or fails. */
export function releaseSlot(task: SwarmTaskNode): void {
  const tier = PRIORITY_TO_TIER[task.priority];
  getSlots(tier).delete(task.taskId);
}

/** Sort tasks by priority for scheduling order. */
export function sortByPriority(tasks: SwarmTaskNode[]): SwarmTaskNode[] {
  const ORDER: Record<SwarmTaskPriority, number> = {
    critical: 0, high: 1, normal: 2, low: 3,
  };
  return [...tasks].sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}

export function pressureReport(): Record<WorkerTier, { inFlight: number; max: number; pressure: number }> {
  const tiers: WorkerTier[] = ["critical", "normal", "low"];
  return Object.fromEntries(
    tiers.map(t => {
      const inFlight = getSlots(t).size;
      const max      = MAX_CONCURRENT[t];
      return [t, { inFlight, max, pressure: inFlight / max }];
    }),
  ) as Record<WorkerTier, { inFlight: number; max: number; pressure: number }>;
}

export function clearAll(): void {
  _inFlight.clear();
}
