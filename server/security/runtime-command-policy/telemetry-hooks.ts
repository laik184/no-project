/**
 * server/security/runtime-command-policy/telemetry-hooks.ts
 *
 * Structured telemetry emissions for runtime command lifecycle events.
 * Every accept, reject, spawn, failure and security block emits a typed
 * bus event for observability and audit.
 *
 * Single responsibility: telemetry emission. No validation logic.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function emit(event: string, projectId: number, payload: Record<string, unknown>): void {
  bus.emit(event as any, { event, projectId, ts: Date.now(), ...payload });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function emitCommandAccepted(
  cmd:       string,
  args:      string[],
  raw:       string,
  projectId: number,
): void {
  emit("runtime.command.accepted", projectId, { cmd, args, raw });
}

export function emitCommandRejected(
  raw:       string,
  reason:    string,
  projectId: number,
): void {
  emit("runtime.command.rejected", projectId, { raw, reason });
  console.warn(`[runtime-command-policy] REJECTED project=${projectId} cmd="${raw}" — ${reason}`);
}

export function emitSecurityBlocked(
  raw:       string,
  reason:    string,
  projectId: number,
): void {
  emit("runtime.security.blocked", projectId, { raw, reason });
  console.error(`[runtime-command-policy] SECURITY BLOCK project=${projectId} cmd="${raw}" — ${reason}`);
}

export function emitSpawnStarted(
  cmd:       string,
  pid:       number,
  port:      number,
  projectId: number,
): void {
  emit("runtime.spawn.started", projectId, { cmd, pid, port });
}

export function emitSpawnFailed(
  cmd:       string,
  reason:    string,
  projectId: number,
): void {
  emit("runtime.spawn.failed", projectId, { cmd, reason });
  console.error(`[runtime-command-policy] SPAWN FAILED project=${projectId} cmd="${cmd}" — ${reason}`);
}
