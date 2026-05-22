/**
 * Responsibility: Synchronization primitive telemetry — records sync.wait, barrier arrivals,
 *                 and barrier completions for the distributed sync barrier layer.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for distributed synchronization.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncMetrics {
  barrierCreations:   number;
  barrierCompletions: number;
  barrierTimeouts:    number;
  barrierCancels:     number;
  syncWaits:          number;
}

// ── Trace ────────────────────────────────────────────────────────────────────

class SyncTrace {
  private readonly metrics: SyncMetrics = {
    barrierCreations: 0, barrierCompletions: 0,
    barrierTimeouts: 0, barrierCancels: 0, syncWaits: 0,
  };

  barrierCreated(runId: string, name: string, expected: number): void {
    this.metrics.barrierCreations++;
    this.emit("agent.started", runId, { barrier: name, expected, event: "barrier_created" });
  }

  barrierCompleted(runId: string, name: string, arrived: number, durationMs: number): void {
    this.metrics.barrierCompletions++;
    this.emit("agent.completed", runId, { barrier: name, arrived, durationMs });
  }

  barrierTimeout(runId: string, name: string, arrived: number, expected: number): void {
    this.metrics.barrierTimeouts++;
    this.emit("distributed.recovery", runId, {
      barrier: name, arrived, expected, reason: "barrier_timeout",
    });
  }

  barrierCancelled(runId: string, name: string): void {
    this.metrics.barrierCancels++;
    this.emit("agent.failed", runId, { barrier: name, reason: "cancelled" });
  }

  syncWait(runId: string, barrier: string, workerId: string): void {
    this.metrics.syncWaits++;
    this.emit("sync.wait", runId, { barrier, workerId });
  }

  snapshot(): SyncMetrics {
    return { ...this.metrics };
  }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId,
        projectId: 0,
        phase:     "distributed.sync",
        agentName: "sync-trace",
        eventType,
        payload,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[sync-trace] Emit error:", err);
    }
  }
}

export const syncTrace = new SyncTrace();
