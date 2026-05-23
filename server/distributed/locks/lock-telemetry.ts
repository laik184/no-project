/**
 * Responsibility: Telemetry for the distributed lock layer — acquired, released,
 *                 contention, expiry, recovery, heartbeat, and timeout events.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the distributed lock system.
 */

import { bus }            from "../../infrastructure/events/bus.ts";
import type { LockEventType } from "./types/index.ts";

interface LockMetrics {
  acquired:   number;
  released:   number;
  contention: number;
  expired:    number;
  recovered:  number;
  timeouts:   number;
}

class LockTelemetry {
  private readonly m: LockMetrics = {
    acquired: 0, released: 0, contention: 0, expired: 0, recovered: 0, timeouts: 0,
  };

  onAcquired(key: string, ownerId: string, backend: "redis" | "in-process"): void {
    this.m.acquired++;
    this.emit("lock.acquired", ownerId, { key, ownerId, backend });
  }

  onReleased(key: string, ownerId: string): void {
    this.m.released++;
    this.emit("lock.released", ownerId, { key, ownerId });
  }

  onContention(key: string, ownerId: string, attempt: number): void {
    this.m.contention++;
    this.emit("lock.contention", ownerId, { key, ownerId, attempt });
  }

  onExpired(key: string, ownerId: string): void {
    this.m.expired++;
    this.emit("lock.expired", ownerId, { key, ownerId });
  }

  onRecovered(key: string, reason: string): void {
    this.m.recovered++;
    this.emit("lock.recovered", "system", { key, reason });
  }

  onHeartbeat(key: string, ownerId: string): void {
    this.emit("lock.heartbeat", ownerId, { key, ownerId, ts: Date.now() });
  }

  onTimeout(key: string, ownerId: string): void {
    this.m.timeouts++;
    this.emit("lock.timeout", ownerId, { key, ownerId });
  }

  snapshot(): LockMetrics { return { ...this.m }; }

  private emit(eventType: LockEventType, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.lock",
        agentName: "lock-telemetry",
        eventType, payload, ts: Date.now(),
      });
    } catch (err) { console.error("[lock-telemetry] Emit error:", err); }
  }
}

export const lockTelemetry = new LockTelemetry();
