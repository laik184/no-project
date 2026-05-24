/**
 * server/api/run-telemetry.routes.ts
 *
 * Run-Scoped Telemetry API — isolated SSE stream + buffer access per run.
 *
 * Routes:
 *   GET /api/telemetry/stream/:runId   — SSE stream for a run (with optional ?since=)
 *   GET /api/telemetry/buffer/:runId   — JSON snapshot of buffered events
 *   GET /api/telemetry/channels        — Active channel stats (monitoring)
 */

import { Router, type Request, type Response } from "express";
import {
  attachSSE,
  getBuffer,
  allChannelStats,
  getOrCreateChannel,
} from "../telemetry/run-scoped/index.ts";

export function createRunTelemetryRouter(): Router {
  const router = Router();

  // SSE stream for a specific run — browser connects here to receive live telemetry
  router.get("/stream/:runId", (req: Request, res: Response) => {
    const { runId } = req.params;
    const projectId  = parseInt(req.query.projectId as string) || 0;
    const since      = parseInt(req.query.since as string)     || 0;

    if (!runId || runId.length < 4) {
      res.status(400).json({ ok: false, error: "runId required (min 4 chars)" });
      return;
    }

    // CORS for SSE
    res.setHeader("Access-Control-Allow-Origin", "*");
    attachSSE(runId, projectId, res, since);
  });

  // JSON snapshot of buffered events for a run (replay / debug)
  router.get("/buffer/:runId", (req: Request, res: Response) => {
    const { runId } = req.params;
    const since     = parseInt(req.query.since as string) || 0;
    res.json({ ok: true, runId, events: getBuffer(runId, since) });
  });

  // Active channel stats (monitoring endpoint)
  router.get("/channels", (_req: Request, res: Response) => {
    res.json({ ok: true, channels: allChannelStats() });
  });

  // Manually emit a test event into a run channel (development / testing only)
  router.post("/emit/:runId", (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({ ok: false, error: "Not available in production" });
      return;
    }
    const { runId }  = req.params;
    const { projectId = 0, eventType, phase, payload } = req.body ?? {};
    if (!eventType) {
      res.status(400).json({ ok: false, error: "eventType required" });
      return;
    }
    const ch    = getOrCreateChannel(runId, projectId);
    const event = ch.emit(eventType, phase ?? "manual", payload ?? {});
    res.json({ ok: true, event });
  });

  return router;
}
