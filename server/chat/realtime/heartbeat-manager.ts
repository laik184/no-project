/**
 * heartbeat-manager.ts — Manages keep-alive heartbeats for chat SSE clients.
 *
 * The infrastructure SSE layer (heartbeat.ts) already handles global pings.
 * This module provides chat-specific heartbeat tracking — detects stale
 * connections and logs diagnostics.
 */
import { SSE_HEARTBEAT_MS } from '../constants/stream.constants.ts';

interface HeartbeatEntry {
  connId:        string;
  projectId:     number;
  lastPingAt:    Date;
  missedPings:   number;
}

const MAX_MISSED_PINGS = 3;
const _entries = new Map<string, HeartbeatEntry>();
let _interval: NodeJS.Timeout | null = null;

export const heartbeatManager = {
  /** Start the heartbeat check loop. Call once at module boot. */
  start(): void {
    if (_interval) return;
    _interval = setInterval(() => {
      heartbeatManager.tick();
    }, SSE_HEARTBEAT_MS);
  },

  /** Stop the heartbeat loop (for clean shutdown / tests). */
  stop(): void {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  },

  /** Register a connection for heartbeat tracking. */
  register(connId: string, projectId: number): void {
    _entries.set(connId, {
      connId,
      projectId,
      lastPingAt:  new Date(),
      missedPings: 0,
    });
  },

  /** Record a received ping for a connection (resets missed counter). */
  ping(connId: string): void {
    const entry = _entries.get(connId);
    if (!entry) return;
    entry.lastPingAt  = new Date();
    entry.missedPings = 0;
  },

  /** Deregister a connection. */
  deregister(connId: string): void {
    _entries.delete(connId);
  },

  /** Internal tick — increments missed pings and logs stale connections. */
  tick(): void {
    for (const entry of _entries.values()) {
      entry.missedPings += 1;
      if (entry.missedPings >= MAX_MISSED_PINGS) {
        console.warn(
          `[chat/heartbeat] Stale connection ${entry.connId} ` +
          `(project ${entry.projectId}) — ${entry.missedPings} missed pings`,
        );
      }
    }
  },

  /** Active connection count tracked by heartbeat. */
  size(): number {
    return _entries.size;
  },
};
