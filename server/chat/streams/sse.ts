/**
 * sse.ts — Unified SSE gateway (single endpoint, hub fan-out pattern)
 *
 * GET /api/realtime
 *   Topic-multiplexed SSE stream. All frontend realtime connections
 *   use this endpoint via RealtimeProvider (client/src/realtime/).
 *
 *   Query params:
 *     topics       comma-separated subset (default: all topics)
 *     projectId    numeric project filter
 *     runId        string run filter
 *     lastEventId  last sequence ID received — triggers replay of missed events
 *
 * Architecture (hub fan-out):
 *   ONE bus listener per event type lives in subscription-manager.ts.
 *   This handler only:
 *     1. Configures SSE headers (setupSse)
 *     2. Replays missed events from the ring buffer (C6 recovery)
 *     3. Registers the connection in the pool (sseManager.register)
 *     4. Wires cleanup on disconnect (onClose)
 *
 * Rules:
 *   - NEVER call bus.subscribe() in this file.
 *   - NEVER call res.write() directly — safeWrite() in backpressure.ts handles it.
 *   - NEVER add legacy endpoints — use /api/realtime with ?topics= filtering.
 *   - ONE connection = ONE sseManager.register() call = ONE pool entry.
 */

import { Router, type Request, type Response } from "express";
import { setupSse, sseSendId, onClose }      from "./sse-utils.ts";
import { ALL_TOPICS, TOPIC }                  from "../../infrastructure/realtime/stream-topics.ts";
import { replay }                             from "../../infrastructure/realtime/replay-cache.ts";
import { sseManager }                         from "../../infrastructure/events/sse/sse-manager.ts";

export function createSseRouter(): Router {
  const r = Router();

  r.get("/api/realtime", (req: Request, res: Response) => {
    // ── 1. Establish SSE stream ──────────────────────────────────────────────
    setupSse(res);

    // ── 2. Parse connection parameters ──────────────────────────────────────
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const runId     = req.query.runId as string | undefined;

    const rawTopics = req.query.topics as string | undefined;
    const requested = new Set<string>(
      rawTopics ? rawTopics.split(",").map((t) => t.trim()) : ALL_TOPICS,
    );

    // ── 3. C6 replay: send missed events before attaching live stream ────────
    // lastEventId tracks the last `id:` field the client received.
    // RealtimeProvider appends it as ?lastEventId=N on every reconnect.
    const rawLastId = (req.headers["last-event-id"] as string | undefined)
                   ?? (req.query.lastEventId as string | undefined);

    if (rawLastId) {
      const lastSeqId = Number(rawLastId);
      if (Number.isFinite(lastSeqId) && lastSeqId > 0) {
        const missed = replay(lastSeqId, requested);
        for (const evt of missed) {
          sseSendId(res, evt.topic, evt.data, evt.seqId);
        }
      }
    }

    // ── 4. Register in pool — starts receiving live events via hub fan-out ───
    // sseManager.register() returns a cleanup fn that removes this connection
    // from the pool when the client disconnects.
    const cleanup = sseManager.register(res, requested, projectId, runId);

    // ── 5. Wire disconnect cleanup ───────────────────────────────────────────
    // onClose handles both normal HTTP close and proxy-dropped TCP sockets.
    onClose(req, cleanup);
  });

  // ── Diagnostics: pool stats for monitoring ───────────────────────────────
  r.get("/api/realtime/stats", (_req: Request, res: Response) => {
    res.json(sseManager.stats());
  });

  return r;
}
