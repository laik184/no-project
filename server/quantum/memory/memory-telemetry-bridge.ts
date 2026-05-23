/**
 * memory-telemetry-bridge.ts
 *
 * Unified telemetry hub for ALL memory subsystems.
 * Routes telemetry events from quantum, distributed, and agent memory into
 * a single consistent stream.
 *
 * Single responsibility: telemetry aggregation and forwarding only.
 *
 * Every memory action MUST emit through this bridge:
 *   queue.enqueue | queue.dequeue | memory.write | memory.commit
 *   memory.rollback | lock.acquire | lock.release | memory.conflict
 *   queue.backpressure | write.retry | write.failed | write.completed
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Telemetry event types ─────────────────────────────────────────────────────

export type MemoryTelemetryEvent =
  | "queue.enqueue"
  | "queue.dequeue"
  | "memory.write"
  | "memory.commit"
  | "memory.rollback"
  | "lock.acquire"
  | "lock.release"
  | "memory.conflict"
  | "queue.backpressure"
  | "write.retry"
  | "write.failed"
  | "write.completed";

export interface MemoryTelemetryPayload {
  event:      MemoryTelemetryEvent;
  requestId:  string;
  filePath?:  string;
  ownerId?:   string;
  runId?:     string;
  queueKey?:  string;
  durationMs?: number;
  retries?:   number;
  checksum?:  string;
  error?:     string;
  meta?:      Record<string, unknown>;
  ts:         number;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class MemoryTelemetryBridge {
  private _metrics: Map<MemoryTelemetryEvent, number> = new Map();

  emit(payload: Omit<MemoryTelemetryPayload, "ts">): void {
    const full: MemoryTelemetryPayload = { ...payload, ts: Date.now() };

    // Increment counter
    this._metrics.set(payload.event, (this._metrics.get(payload.event) ?? 0) + 1);

    // Forward to the platform event bus under a standardised channel
    try {
      bus.emit("memory.telemetry" as any, full);
    } catch {
      // Never let telemetry errors propagate into the write path
    }
  }

  // ── Convenience emitters ─────────────────────────────────────────────────

  enqueue(requestId: string, filePath: string, ownerId: string, runId: string, queueKey: string): void {
    this.emit({ event: "queue.enqueue", requestId, filePath, ownerId, runId, queueKey });
  }

  dequeue(requestId: string, filePath: string, ownerId: string, runId: string, queueKey: string): void {
    this.emit({ event: "queue.dequeue", requestId, filePath, ownerId, runId, queueKey });
  }

  writeStarted(requestId: string, filePath: string, ownerId: string, runId: string): void {
    this.emit({ event: "memory.write", requestId, filePath, ownerId, runId });
  }

  commit(requestId: string, filePath: string, ownerId: string, runId: string, durationMs: number, checksum?: string): void {
    this.emit({ event: "memory.commit", requestId, filePath, ownerId, runId, durationMs, checksum });
    this.emit({ event: "write.completed", requestId, filePath, ownerId, runId, durationMs, checksum });
  }

  rollback(requestId: string, filePath: string, ownerId: string, runId: string, error: string): void {
    this.emit({ event: "memory.rollback", requestId, filePath, ownerId, runId, error });
  }

  lockAcquire(requestId: string, filePath: string, runId: string): void {
    this.emit({ event: "lock.acquire", requestId, filePath, runId });
  }

  lockRelease(requestId: string, filePath: string, runId: string): void {
    this.emit({ event: "lock.release", requestId, filePath, runId });
  }

  conflict(requestId: string, filePath: string, runId: string, error: string): void {
    this.emit({ event: "memory.conflict", requestId, filePath, runId, error });
  }

  backpressure(queueKey: string, depth: number, verdict: string): void {
    this.emit({ event: "queue.backpressure", requestId: "system", queueKey, meta: { depth, verdict } });
  }

  retry(requestId: string, filePath: string, runId: string, attempt: number, error: string): void {
    this.emit({ event: "write.retry", requestId, filePath, runId, retries: attempt, error });
  }

  failed(requestId: string, filePath: string, ownerId: string, runId: string, durationMs: number, error: string): void {
    this.emit({ event: "write.failed", requestId, filePath, ownerId, runId, durationMs, error });
  }

  // ── Metrics snapshot ─────────────────────────────────────────────────────

  metrics(): Record<string, number> {
    return Object.fromEntries(this._metrics);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const memoryTelemetryBridge = new MemoryTelemetryBridge();
