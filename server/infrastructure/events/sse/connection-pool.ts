/**
 * connection-pool.ts — registry of all live SSE connections.
 *
 * Replaces the per-connection bus.subscribe() pattern with a single
 * central registry. The subscription-manager holds ONE bus listener per
 * event type and calls pool.fanOut() which iterates only live connections.
 *
 * Benefits vs. per-connection subscribe:
 *   - O(1) bus listeners regardless of connected client count
 *   - No MaxListeners warnings at scale
 *   - Single place to apply filters, backpressure, and throttle
 *   - Stale connection detection built-in
 *
 * Usage:
 *   const id = pool.add(conn);
 *   pool.fanOut(TOPIC.AGENT, data, seqId, (c) => matchesAgent(c, event));
 *   pool.remove(id);
 */

import type { Response } from "express";
import type { PooledConnection } from "../types/connection.types.ts";
import { safeWrite, isThrottled } from "../core/backpressure.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Drop event for a connection if no write has occurred in this window. */
const STALE_TIMEOUT_MS = 60_000;

/** Minimum ms between console.log deliveries per connection (20 ev/s max). */
export const CONSOLE_THROTTLE_MS = 50;

/** Minimum ms between runtime.observation deliveries per connection. */
export const OBSERVATION_THROTTLE_MS = 2_000;

// ── ID factory ────────────────────────────────────────────────────────────────

let _seq = 0;
function nextId(): string { return `sse-${++_seq}`; }

// ── Pool ──────────────────────────────────────────────────────────────────────

class ConnectionPool {
  private readonly connections = new Map<string, PooledConnection>();

  /** Register a new SSE connection. Returns the connection ID. */
  add(
    res:       Response,
    topics:    ReadonlySet<string>,
    projectId: number | null,
    runId:     string | undefined,
  ): string {
    const id = nextId();
    const conn: PooledConnection = {
      id,
      res,
      topics,
      projectId,
      runId,
      connectedAt:   Date.now(),
      lastWriteAt:   Date.now(),
      backpressured: false,
      topicThrottle: new Map(),
    };
    this.connections.set(id, conn);

    if (process.env.NODE_ENV !== "production") {
      console.debug(`[sse-pool] +conn ${id} topics=[${[...topics].join(",")}] project=${projectId ?? "*"} total=${this.connections.size}`);
    }

    return id;
  }

  /** Deregister a connection (called on req close). */
  remove(id: string): void {
    if (!this.connections.delete(id)) return;
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[sse-pool] -conn ${id} total=${this.connections.size}`);
    }
  }

  /** Total number of live SSE connections. */
  getCount(): number { return this.connections.size; }

  /** Iterate all connections — used by heartbeat.ts only. */
  forEach(fn: (conn: PooledConnection) => void): void {
    for (const conn of this.connections.values()) fn(conn);
  }

  /**
   * Fan-out an event to every connection that:
   *   1. Subscribed to the given topic
   *   2. Passes the caller-supplied filter (project/run scoping)
   *   3. Is not backpressured
   *   4. Is not stale
   *   5. Passes per-topic throttle (if throttleMs > 0)
   *
   * @param topic       SSE event name
   * @param data        Event payload
   * @param seqId       Replay-cache sequence ID (assigned once upstream)
   * @param filter      Optional per-event filter from a channel module
   * @param throttleMs  Optional per-topic throttle interval in ms
   */
  fanOut(
    topic:       string,
    data:        unknown,
    seqId:       number,
    filter?:     (conn: PooledConnection) => boolean,
    throttleMs?: number,
  ): void {
    const now = Date.now();

    for (const conn of this.connections.values()) {
      if (!conn.topics.has(topic)) continue;

      // Stale guard: drop event and let heartbeat/cleanup handle removal
      if (now - conn.lastWriteAt > STALE_TIMEOUT_MS && conn.lastWriteAt !== conn.connectedAt) {
        continue;
      }

      if (filter && !filter(conn)) continue;

      if (throttleMs && isThrottled(conn, topic, throttleMs)) continue;

      safeWrite(conn, topic, data, seqId);
    }
  }

  /** Diagnostic snapshot — used by health endpoints. */
  stats(): { total: number; topics: Record<string, number> } {
    const topics: Record<string, number> = {};
    for (const conn of this.connections.values()) {
      for (const t of conn.topics) {
        topics[t] = (topics[t] ?? 0) + 1;
      }
    }
    return { total: this.connections.size, topics };
  }
}

export const pool = new ConnectionPool();
