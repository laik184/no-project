/**
 * Responsibility: Emits telemetry events for all Redis lifecycle transitions.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the Redis layer.
 */

import { bus }               from "../../infrastructure/events/bus.ts";
import type { RedisEventType } from "./types/index.ts";

class RedisTelemetry {
  private errorCount = 0;
  private connectedAt: number | null = null;

  onConnected(): void {
    this.connectedAt = Date.now();
    this.emit("redis.connected", { ts: this.connectedAt });
    console.log("[redis] Connected and ready.");
  }

  onReady(): void {
    this.emit("redis.ready", { ts: Date.now() });
  }

  onDisconnected(): void {
    this.emit("redis.disconnected", { uptime: this.uptime() });
  }

  onReconnecting(attempt: number, delayMs: number): void {
    this.emit("redis.reconnecting", { attempt, delayMs });
  }

  onError(err: Error): void {
    this.errorCount++;
    this.emit("redis.error", { message: err.message, errorCount: this.errorCount });
  }

  onClose(): void {
    this.emit("redis.close", { ts: Date.now() });
    console.warn("[redis] Connection closed.");
  }

  snapshot() {
    return { errorCount: this.errorCount, connectedAt: this.connectedAt, uptime: this.uptime() };
  }

  private uptime(): number {
    return this.connectedAt ? Date.now() - this.connectedAt : 0;
  }

  private emit(eventType: RedisEventType, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId:     "redis",
        projectId: 0,
        phase:     "infrastructure.redis",
        agentName: "redis-telemetry",
        eventType,
        payload,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[redis-telemetry] Emit error:", err);
    }
  }
}

export const redisTelemetry = new RedisTelemetry();
