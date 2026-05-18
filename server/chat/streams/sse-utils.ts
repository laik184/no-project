/**
 * sse-utils.ts
 *
 * Shared SSE primitives used by ALL SSE endpoints in this server.
 * Single source of truth for SSE formatting — no duplicated implementations.
 *
 * Rules enforced here:
 *  - ONE write per event (atomic frame, no partial delivery risk)
 *  - ONE formatting strategy (`event: X\ndata: Y\n\n`)
 *  - ONE heartbeat factory
 *  - Guaranteed cleanup even when req.destroyed races onClose registration (L3)
 *  - Socket-level backup cleanup for proxy-dropped connections (L7)
 */

import type { Request, Response } from "express";

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Initialise an HTTP response as a persistent SSE stream.
 * Must be called exactly once per SSE endpoint, before any events are sent.
 */
export function setupSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write(": connected\n\n");
}

// ─── Event Emission ───────────────────────────────────────────────────────────

/**
 * Write a single named SSE event frame.
 *
 * Produces exactly:
 *   event: <name>\n
 *   data: <json>\n
 *   \n
 *
 * One atomic string write prevents partial frame delivery.
 * NEVER call res.write() directly in SSE handlers — use this function.
 */
export function sseSend(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Write a named SSE event frame that includes an `id:` field.
 * The id is the monotonic sequence number from the replay cache.
 * Browser EventSource tracks this and sends it as Last-Event-ID on reconnect.
 *
 *   id: <seqId>
 *   event: <name>
 *   data: <json>
 *
 */
export function sseSendId(res: Response, event: string, data: unknown, seqId: number): void {
  res.write(`id: ${seqId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/** SSE comment ping — keeps the connection alive through proxies. */
const PING_INTERVAL_MS = 15_000;

/**
 * Start a periodic SSE heartbeat and return a cancel function.
 * Caller must pass the returned cancel into onClose().
 */
export function startHeartbeat(res: Response): () => void {
  const id = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(id); }
  }, PING_INTERVAL_MS);
  return () => clearInterval(id);
}

// ─── Cleanup Builder ──────────────────────────────────────────────────────────

/**
 * Register the canonical SSE cleanup handler on a request.
 *
 * Accepts any number of unsubscribe / cancel functions.
 * All are called exactly once when the connection closes.
 *
 * L3 fix — guaranteed cleanup even when:
 *   • req.destroyed is already true when onClose() is called (race condition
 *     between setupSse and subscription registration in the handler body)
 *   • A reverse proxy drops the TCP socket without sending a FIN, causing
 *     req "close" to never fire — we listen on the underlying socket too (L7)
 *
 * Usage:
 *   const off1 = bus.subscribe(...);
 *   const off2 = bus.subscribe(...);
 *   const stopHb = startHeartbeat(res);
 *   onClose(req, stopHb, off1, off2);
 */
export function onClose(req: Request, ...cleanups: Array<() => void>): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    for (const fn of cleanups) { try { fn(); } catch {} }
  };

  // Fast-path: connection already gone before we registered
  if ((req as any).destroyed) {
    run();
    return;
  }

  // Primary: HTTP request close (reliable for most clients)
  req.once("close", run);

  // Backup: underlying TCP socket close (fires when proxy drops the connection
  // without sending a proper HTTP close, which would miss req "close").
  // req.socket is the same socket as res.socket — both reference the underlying
  // IncomingMessage net.Socket (the cast silences the Express type gap).
  const sock = (req as any).socket as import("net").Socket | undefined;
  if (sock && !sock.destroyed) {
    sock.once("close", run);
  }
}
