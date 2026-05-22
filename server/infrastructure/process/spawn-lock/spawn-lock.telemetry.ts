/**
 * server/infrastructure/process/spawn-lock/spawn-lock.telemetry.ts
 *
 * Structured telemetry for every spawn lock lifecycle event.
 * All emit calls go to the event bus for SSE fan-out and audit.
 *
 * Single responsibility: emit only. No lock logic, no types defined here.
 */

import { bus } from "../../../infrastructure/events/bus.ts";
import type { SpawnLockEvent } from "./spawn-lock.types.ts";

// ── Internal emit ─────────────────────────────────────────────────────────────

function emit(
  event:     SpawnLockEvent,
  projectId: number,
  owner:     string,
  startedAt: number,
  extra:     Record<string, unknown> = {},
): void {
  const payload = {
    event, projectId, owner, startedAt,
    durationMs: Date.now() - startedAt,
    ts: Date.now(),
    ...extra,
  };
  bus.emit("spawn.lock" as any, payload);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function emitLockAcquired(projectId: number, owner: string, startedAt: number): void {
  console.log(`[spawn-lock] ACQUIRED project=${projectId} owner="${owner}"`);
  emit("spawn.lock.acquired", projectId, owner, startedAt);
}

export function emitLockReused(
  projectId: number,
  owner:     string,
  startedAt: number,
  reusedBy:  number,
): void {
  console.log(`[spawn-lock] REUSED project=${projectId} reusedBy=${reusedBy} — deduplicating concurrent start`);
  emit("spawn.lock.reused", projectId, owner, startedAt, { reusedBy });
}

export function emitLockReleased(projectId: number, owner: string, startedAt: number, reusedBy: number): void {
  console.log(
    `[spawn-lock] RELEASED project=${projectId} owner="${owner}" ` +
    `duration=${Date.now() - startedAt}ms reusedBy=${reusedBy}`,
  );
  emit("spawn.lock.released", projectId, owner, startedAt, { reusedBy });
}

export function emitLockTimeout(projectId: number, owner: string, startedAt: number): void {
  console.warn(`[spawn-lock] TIMEOUT project=${projectId} owner="${owner}" — auto-releasing after ${Date.now() - startedAt}ms`);
  emit("spawn.lock.timeout", projectId, owner, startedAt);
}

export function emitLockFailed(projectId: number, owner: string, startedAt: number, reason: string): void {
  console.error(`[spawn-lock] FAILED project=${projectId} owner="${owner}" reason="${reason}"`);
  emit("spawn.lock.failed", projectId, owner, startedAt, { reason });
}

export function emitLockRejected(projectId: number, owner: string, reason: string): void {
  console.warn(`[spawn-lock] REJECTED project=${projectId} owner="${owner}" reason="${reason}"`);
  emit("spawn.lock.rejected", projectId, owner, Date.now(), { reason });
}
