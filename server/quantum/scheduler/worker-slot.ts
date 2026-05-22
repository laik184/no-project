/**
 * server/quantum/scheduler/worker-slot.ts
 *
 * Quantum scheduler slot — tracks the lifecycle of a single worker unit
 * within the centralized pool. Pure state with immutable transitions.
 *
 * Distinct from server/distributed/workers/worker-slot.ts which is used
 * by the legacy distributed pool. This slot is owned by the quantum scheduler.
 */

import { v4 as uuidv4 } from "uuid";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SlotStatus = "idle" | "busy" | "draining" | "failed" | "terminated";

export interface QuantumSlot {
  readonly id:           string;
  readonly status:       SlotStatus;
  readonly taskId:       string | null;
  readonly runId:        string | null;
  readonly assignedAt:   number | null;
  readonly lastActiveAt: number;
  readonly failureCount: number;
  readonly maxFailures:  number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSlot(maxFailures = 3): QuantumSlot {
  return {
    id:           uuidv4(),
    status:       "idle",
    taskId:       null,
    runId:        null,
    assignedAt:   null,
    lastActiveAt: Date.now(),
    failureCount: 0,
    maxFailures,
  };
}

// ── State transitions (pure — return new slot, never mutate) ──────────────────

export function assignSlot(slot: QuantumSlot, taskId: string, runId: string): QuantumSlot {
  return { ...slot, status: "busy", taskId, runId, assignedAt: Date.now(), lastActiveAt: Date.now() };
}

export function releaseSlot(slot: QuantumSlot): QuantumSlot {
  return { ...slot, status: "idle", taskId: null, runId: null, assignedAt: null, lastActiveAt: Date.now() };
}

export function drainSlot(slot: QuantumSlot): QuantumSlot {
  return { ...slot, status: "draining" };
}

export function failSlot(slot: QuantumSlot): QuantumSlot {
  const next = slot.failureCount + 1;
  return {
    ...slot,
    status:       next >= slot.maxFailures ? "terminated" : "failed",
    failureCount: next,
    taskId:       null,
    runId:        null,
    assignedAt:   null,
    lastActiveAt: Date.now(),
  };
}

export function reviveSlot(slot: QuantumSlot): QuantumSlot {
  if (slot.status === "terminated") return slot;
  return { ...slot, status: "idle", taskId: null, runId: null, assignedAt: null, lastActiveAt: Date.now() };
}

// ── Predicates ────────────────────────────────────────────────────────────────

export function isAvailable(slot: QuantumSlot): boolean {
  return slot.status === "idle";
}

export function isActive(slot: QuantumSlot): boolean {
  return slot.status === "busy" || slot.status === "draining";
}

export function isStale(slot: QuantumSlot, maxInactiveMs = 300_000): boolean {
  return Date.now() - slot.lastActiveAt > maxInactiveMs;
}

export function isTimedOut(slot: QuantumSlot, timeoutMs: number): boolean {
  if (!slot.assignedAt || slot.status !== "busy") return false;
  return Date.now() - slot.assignedAt > timeoutMs;
}
