/**
 * heartbeat.ts — global SSE keep-alive manager.
 *
 * One setInterval for ALL pooled connections instead of one per connection.
 * At 1000 concurrent clients the old approach created 1000 independent timers;
 * this approach uses exactly 1 regardless of client count.
 *
 * Stale detection: connections that have not received a successful write in
 * STALE_MS milliseconds are logged as stale. Actual removal happens when the
 * client's TCP connection drops and triggers onClose (req.on("close")).
 *
 * Usage:
 *   startGlobalHeartbeat();   // called once at startup from sse-manager.ts
 *   stopGlobalHeartbeat();    // called on SIGTERM / tests
 */

import type { PooledConnection } from "../types/connection.types.ts";
import { pool } from "./connection-pool.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const PING_INTERVAL_MS = 15_000;
const STALE_WARN_MS    = 45_000;

// ── State ─────────────────────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ping(conn: PooledConnection): void {
  if (conn.backpressured)     return;
  if (conn.res.writableEnded) return;
  try {
    conn.res.write(": ping\n\n");
    conn.lastWriteAt = Date.now();
  } catch {
    // Socket already gone — onClose will clean up
  }
}

function checkStale(conn: PooledConnection, now: number): void {
  if (now - conn.lastWriteAt > STALE_WARN_MS) {
    console.warn(
      `[sse-heartbeat] stale connection ${conn.id} ` +
      `(silent ${Math.round((now - conn.lastWriteAt) / 1000)}s) ` +
      `project=${conn.projectId ?? "*"}`,
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the global heartbeat interval.
 * Idempotent — safe to call multiple times.
 */
export function startGlobalHeartbeat(): void {
  if (_timer) return;

  _timer = setInterval(() => {
    const now = Date.now();
    pool.forEach((conn) => {
      ping(conn);
      checkStale(conn, now);
    });
  }, PING_INTERVAL_MS);

  _timer.unref?.(); // Don't block process exit
}

/**
 * Stop the global heartbeat interval.
 * Called on graceful shutdown.
 */
export function stopGlobalHeartbeat(): void {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
}
