/**
 * server/infrastructure/process/spawn-lock/spawn-lock.types.ts
 *
 * Types for the per-project spawn concurrency lock system.
 * Single responsibility: type definitions only. No imports, no side-effects.
 */

// ── Lock entry ────────────────────────────────────────────────────────────────

/**
 * An in-flight spawn operation tracked by the lock registry.
 * The `promise` field holds the original spawn result — concurrent callers
 * that arrive while this entry exists receive the same promise (deduplication).
 */
export interface SpawnLockEntry {
  /** Shared promise returned to all concurrent callers for this projectId. */
  promise:   Promise<unknown>;
  /** Human-readable tag of the caller that acquired the lock. */
  owner:     string;
  /** Unix ms when the lock was acquired. */
  startedAt: number;
  /** How many additional callers have been deduplicated onto this promise. */
  reusedBy:  number;
  /** Auto-release timer handle — cleared on normal release. */
  timeoutId: NodeJS.Timeout;
}

// ── Telemetry payload ─────────────────────────────────────────────────────────

export interface SpawnLockTelemetryPayload {
  event:      SpawnLockEvent;
  projectId:  number;
  owner:      string;
  startedAt:  number;
  durationMs: number;
  reusedBy?:  number;
  reason?:    string;
  ts:         number;
}

// ── Event names ───────────────────────────────────────────────────────────────

export type SpawnLockEvent =
  | "spawn.lock.acquired"
  | "spawn.lock.reused"
  | "spawn.lock.released"
  | "spawn.lock.timeout"
  | "spawn.lock.failed"
  | "spawn.lock.rejected";
