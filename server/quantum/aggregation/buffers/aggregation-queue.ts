/**
 * buffers/aggregation-queue.ts
 *
 * FIFO event queue with backpressure for streaming path events.
 * Prevents unbounded memory growth under high-throughput conditions.
 * No I/O, no telemetry — pure in-process queue.
 */

import type { StreamingPathEvent, StreamingSessionId } from "../contracts/aggregation.types.ts";

// ── Configuration ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_DEPTH = 512;

// ── Queue entry ───────────────────────────────────────────────────────────────

interface QueueEntry {
  event:      StreamingPathEvent;
  enqueuedAt: number;
}

// ── AggregationQueue ──────────────────────────────────────────────────────────

export class AggregationQueue {
  private readonly _queues = new Map<StreamingSessionId, QueueEntry[]>();
  private readonly _maxDepth: number;

  constructor(maxDepth: number = DEFAULT_MAX_DEPTH) {
    this._maxDepth = maxDepth;
  }

  // ── Enqueue ──────────────────────────────────────────────────────────────────

  enqueue(event: StreamingPathEvent): { accepted: boolean; dropped?: string } {
    const { sessionId } = event;
    if (!this._queues.has(sessionId)) this._queues.set(sessionId, []);
    const q = this._queues.get(sessionId)!;

    if (q.length >= this._maxDepth) {
      return { accepted: false, dropped: `Queue depth ${this._maxDepth} exceeded for session ${sessionId}` };
    }

    q.push({ event, enqueuedAt: Date.now() });
    return { accepted: true };
  }

  // ── Dequeue ───────────────────────────────────────────────────────────────────

  dequeue(sessionId: StreamingSessionId): StreamingPathEvent | undefined {
    const entry = this._queues.get(sessionId)?.shift();
    return entry?.event;
  }

  drainAll(sessionId: StreamingSessionId): StreamingPathEvent[] {
    const q = this._queues.get(sessionId) ?? [];
    this._queues.set(sessionId, []);
    return q.map(e => e.event);
  }

  // ── Inspection ────────────────────────────────────────────────────────────────

  depth(sessionId: StreamingSessionId): number {
    return this._queues.get(sessionId)?.length ?? 0;
  }

  isEmpty(sessionId: StreamingSessionId): boolean {
    return this.depth(sessionId) === 0;
  }

  peek(sessionId: StreamingSessionId): StreamingPathEvent | undefined {
    return this._queues.get(sessionId)?.[0]?.event;
  }

  // ── Backpressure status ───────────────────────────────────────────────────────

  pressure(sessionId: StreamingSessionId): number {
    return this.depth(sessionId) / this._maxDepth;
  }

  isThrottled(sessionId: StreamingSessionId): boolean {
    return this.pressure(sessionId) >= 0.8;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  clear(sessionId: StreamingSessionId): void {
    this._queues.delete(sessionId);
  }

  sessions(): StreamingSessionId[] {
    return Array.from(this._queues.keys());
  }
}

export const aggregationQueue = new AggregationQueue();
