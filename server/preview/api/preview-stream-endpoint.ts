/**
 * preview-stream-endpoint.ts — SSE endpoint handler for preview events.
 * Registers the response with previewSseManager and holds the connection open.
 */

import type { Request, Response } from "express";
import { previewSseManager }      from "../streaming/preview-sse-manager.ts";
import { ALL_PREVIEW_TOPICS }     from "../streaming/preview-topic-registry.ts";

export function handlePreviewStream(req: Request, res: Response): void {
  const projectId = req.query.projectId != null
    ? Number(req.query.projectId)
    : undefined;

  // Set SSE headers
  res.setHeader("Content-Type",                "text/event-stream");
  res.setHeader("Cache-Control",               "no-cache, no-transform");
  res.setHeader("Connection",                  "keep-alive");
  res.setHeader("X-Accel-Buffering",           "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Send an initial ping to confirm connection
  res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  // Register with the SSE manager
  const cleanup = previewSseManager.register(res, {
    projectId: isNaN(projectId as number) ? undefined : (projectId as number),
    topics:    ALL_PREVIEW_TOPICS,
  });

  // Heartbeat every 25 s to prevent proxy timeout
  const hb = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch { clearInterval(hb); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(hb);
    cleanup();
  });
}
