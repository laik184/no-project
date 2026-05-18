/**
 * sse-manager.ts — SSE connection registration and lifecycle coordinator.
 *
 * Single entry point for adding new SSE clients to the system.
 * Importing this module automatically:
 *   1. Registers ONE bus listener per event type (subscription-manager.ts)
 *   2. Starts the global heartbeat interval (heartbeat.ts)
 *
 * Usage in sse.ts:
 *   import { sseManager } from "../../infrastructure/events/sse/sse-manager.ts";
 *
 *   // After replay and setupSse:
 *   const cleanup = sseManager.register(res, topics, projectId, runId);
 *   onClose(req, cleanup);
 *
 * Architecture contract:
 *   - sseManager.register() MUST be called after setupSse() and after
 *     replaying missed events (so pool listeners don't duplicate replay).
 *   - The returned cleanup fn removes the connection from the pool.
 *     Always pass it to onClose().
 *   - Never call bus.subscribe() directly in SSE route handlers.
 */

import type { Response } from "express";
import { pool }                from "./connection-pool.ts";
import { startGlobalHeartbeat } from "./heartbeat.ts";
import "../core/subscription-manager.ts"; // registers ONE listener per bus event

// ── Boot ──────────────────────────────────────────────────────────────────────
// One global heartbeat for all pooled connections.
startGlobalHeartbeat();

// ── Manager ───────────────────────────────────────────────────────────────────

class SseManager {
  /**
   * Register a new SSE client in the connection pool.
   *
   * @param res       Express Response already configured as SSE stream
   * @param topics    Topics the client subscribed to (from ?topics= query param)
   * @param projectId Project scope — null means all projects
   * @param runId     Run scope — undefined means all runs
   * @returns         Cleanup function — pass to onClose(req, cleanup)
   */
  register(
    res:       Response,
    topics:    ReadonlySet<string>,
    projectId: number | null,
    runId:     string | undefined,
  ): () => void {
    const id = pool.add(res, topics, projectId, runId);
    return () => pool.remove(id);
  }

  /** Live count of open SSE connections. */
  get connectionCount(): number {
    return pool.getCount();
  }

  /** Diagnostic snapshot — topic distribution across all connections. */
  stats(): ReturnType<typeof pool.stats> {
    return pool.stats();
  }
}

export const sseManager = new SseManager();
