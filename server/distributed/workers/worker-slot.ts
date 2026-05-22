/**
 * Responsibility: Single worker slot state + pure state transitions.
 * Dependencies: none — pure types and state functions only.
 * Failure: slot transitions to "failed"; after maxFailures → "terminated".
 * Telemetry: state transitions captured by worker-registry for worker-trace.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkerSlotStatus =
  | "idle"
  | "busy"
  | "draining"
  | "failed"
  | "terminated";

export type WorkerType = "io-bound" | "cpu-bound" | "llm";

export interface WorkerSlot {
  readonly id:            string;
  readonly type:          WorkerType;
  readonly status:        WorkerSlotStatus;
  readonly taskId:        string | null;
  readonly runId:         string | null;
  readonly startedAt:     number | null;
  readonly lastHeartbeat: number;
  readonly failureCount:  number;
  readonly maxFailures:   number;
  readonly timeoutMs:     number;
}

export interface WorkerSlotOptions {
  maxFailures?: number;
  timeoutMs?:   number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createWorkerSlot(
  id:   string,
  type: WorkerType,
  opts: WorkerSlotOptions = {},
): WorkerSlot {
  return {
    id,
    type,
    status:        "idle",
    taskId:        null,
    runId:         null,
    startedAt:     null,
    lastHeartbeat: Date.now(),
    failureCount:  0,
    maxFailures:   opts.maxFailures ?? 3,
    timeoutMs:     opts.timeoutMs  ?? 60_000,
  };
}

// ── State Transitions (pure) ──────────────────────────────────────────────────

export function assignTask(slot: WorkerSlot, taskId: string, runId: string): WorkerSlot {
  return { ...slot, status: "busy", taskId, runId, startedAt: Date.now() };
}

export function heartbeat(slot: WorkerSlot): WorkerSlot {
  return { ...slot, lastHeartbeat: Date.now() };
}

export function releaseSlot(slot: WorkerSlot): WorkerSlot {
  return { ...slot, status: "idle", taskId: null, runId: null, startedAt: null };
}

export function drainSlot(slot: WorkerSlot): WorkerSlot {
  return { ...slot, status: "draining" };
}

export function failSlot(slot: WorkerSlot): WorkerSlot {
  const next = slot.failureCount + 1;
  return {
    ...slot,
    status:       next >= slot.maxFailures ? "terminated" : "failed",
    failureCount: next,
    taskId:       null,
    runId:        null,
    startedAt:    null,
  };
}

export function reviveSlot(slot: WorkerSlot): WorkerSlot {
  if (slot.status === "terminated") return slot; // cannot revive terminated
  return { ...slot, status: "idle", taskId: null, runId: null, startedAt: null };
}

// ── Predicates ────────────────────────────────────────────────────────────────

export function isHealthy(slot: WorkerSlot, maxHeartbeatAgeMs = 30_000): boolean {
  if (slot.status === "terminated" || slot.status === "failed") return false;
  return Date.now() - slot.lastHeartbeat < maxHeartbeatAgeMs;
}

export function isTimedOut(slot: WorkerSlot): boolean {
  if (!slot.startedAt || slot.status !== "busy") return false;
  return Date.now() - slot.startedAt > slot.timeoutMs;
}

export function isAvailable(slot: WorkerSlot): boolean {
  return slot.status === "idle";
}
