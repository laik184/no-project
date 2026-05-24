/**
 * server/telemetry/run-scoped/run-scoped-telemetry.ts
 *
 * RunScopedTelemetry — global registry of isolated per-run telemetry channels.
 *
 * Responsibilities:
 *   - Create and manage one RunTelemetryChannel per runId
 *   - Route lifecycle events to the correct run channel
 *   - Prevent cross-run telemetry mixing
 *   - Auto-destroy channels on run completion
 *   - Expose health snapshot across all active channels
 *
 * Single responsibility: channel lifecycle registry. No SSE routing logic.
 */

import { RunTelemetryChannel, type ChannelStats, type TelemetryEvent } from "./run-telemetry-channel.ts";
import { bus } from "../../infrastructure/events/bus.ts";
import type { Response } from "express";

// ── Registry ──────────────────────────────────────────────────────────────────

const _channels = new Map<string, RunTelemetryChannel>();  // runId → channel

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get or create a telemetry channel for a run.
 * Idempotent — returns existing channel if already active.
 */
export function getOrCreateChannel(runId: string, projectId: number): RunTelemetryChannel {
  const existing = _channels.get(runId);
  if (existing) return existing;
  const ch = new RunTelemetryChannel(runId, projectId);
  _channels.set(runId, ch);
  return ch;
}

/** Emit a telemetry event into the correct run-scoped channel. */
export function emitToRun(
  runId:     string,
  projectId: number,
  eventType: string,
  phase:     string,
  payload:   unknown,
): TelemetryEvent | null {
  const ch = _channels.get(runId) ?? getOrCreateChannel(runId, projectId);
  return ch.emit(eventType, phase, payload);
}

/** Attach an SSE response to a run's telemetry stream. */
export function attachSSE(runId: string, projectId: number, res: Response, replaySince = 0): void {
  const ch = getOrCreateChannel(runId, projectId);
  ch.attachSSE(res, replaySince);
}

/** Retrieve buffered events for a run since a timestamp. */
export function getBuffer(runId: string, sinceTs = 0): TelemetryEvent[] {
  return _channels.get(runId)?.getBuffer(sinceTs) ?? [];
}

/** Destroy the telemetry channel for a run (called at run.completed). */
export function destroyChannel(runId: string): void {
  const ch = _channels.get(runId);
  if (!ch) return;
  ch.destroy();
  _channels.delete(runId);
}

/** Stats for all active channels (monitoring endpoint). */
export function allChannelStats(): ChannelStats[] {
  return Array.from(_channels.values()).map(ch => ch.stats());
}

/** Count of active channels. */
export function activeChannelCount(): number {
  return _channels.size;
}

// ── Bus bridge ────────────────────────────────────────────────────────────────
// Auto-route bus events that carry runId into the correct telemetry channel.

bus.on("agent.event", (payload: any) => {
  if (!payload?.runId || !payload?.projectId) return;
  const ch = _channels.get(payload.runId);
  if (ch) ch.emit(payload.eventType ?? "agent.event", payload.phase ?? "unknown", payload);
});

bus.on("run.lifecycle", (payload: any) => {
  if (!payload?.runId || !payload?.projectId) return;
  const ch = _channels.get(payload.runId);
  if (!ch) return;
  ch.emit(payload.phase === "completed" ? "run.completed" : `run.${payload.phase}`, "lifecycle", payload);
  if (payload.phase === "completed" || payload.phase === "failed") {
    // Delay destruction to allow final event flush
    setTimeout(() => destroyChannel(payload.runId), 30_000);
  }
});
