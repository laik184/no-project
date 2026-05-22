/**
 * lock-telemetry.ts
 *
 * Centralised telemetry emitter for ALL lock lifecycle events.
 * No other lock module emits directly to the bus.
 * Single responsibility: event emission + metrics counters.
 */

import { bus }                           from "../../infrastructure/events/bus.ts";
import { incrementCounter, recordDuration } from "../../orchestration/telemetry/orchestration-metrics.ts";
import type { LockEventType, LockEventPayload } from "./file-lock-types.ts";

// ── Internal emit ─────────────────────────────────────────────────────────────

function emit(type: LockEventType, payload: LockEventPayload): void {
  bus.emit("agent.event", {
    eventType: type,
    payload,
    ts: Date.now(),
  });
  incrementCounter(type, {
    path:    payload.path.slice(0, 80),   // truncate for label safety
    ownerId: payload.ownerId,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function telemetryLockAcquired(p: LockEventPayload): void {
  emit("lock.acquired", p);
}

export function telemetryLockFailed(p: LockEventPayload): void {
  emit("lock.failed", p);
}

export function telemetryLockReleased(p: LockEventPayload): void {
  emit("lock.released", p);
}

export function telemetryLockExpired(p: LockEventPayload): void {
  emit("lock.expired", p);
}

export function telemetryLockRetry(p: LockEventPayload): void {
  emit("lock.retry", p);
}

export function telemetryLockForceRelease(p: LockEventPayload): void {
  emit("lock.force_release", p);
}

export function telemetryLockCollision(p: LockEventPayload): void {
  emit("lock.collision", p);
}

export function telemetryLockStaleCleaned(p: LockEventPayload): void {
  emit("lock.stale_cleaned", p);
}

/**
 * Records acquisition duration for histogram analysis.
 * Call after a successful acquire with the elapsed ms.
 */
export function telemetryAcquireDuration(ownerId: string, ms: number): void {
  recordDuration("lock.acquire.duration_ms", ms, { ownerId });
}
