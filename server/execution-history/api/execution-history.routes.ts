/**
 * server/execution-history/api/execution-history.routes.ts
 *
 * REST inspector API for tool execution history.
 *
 * Routes:
 *   GET  /api/execution-history                  — list executions (filterable)
 *   GET  /api/execution-history/:executionId      — single execution detail
 *   GET  /api/execution-history/run/:runId/timeline — ordered timeline
 *   GET  /api/execution-history/run/:runId/metrics  — run-level health metrics
 *   GET  /api/execution-history/metrics/global      — global aggregate metrics
 *   GET  /api/execution-history/replay/:executionId — replay-safe envelope
 */

import { Router, type Request, type Response } from "express";
import {
  queryExecutions,
  getExecutionById,
  getRunTimeline,
} from "../core/execution-query.ts";
import { buildTimeline } from "../timeline/timeline-builder.ts";
import { computeToolMetrics, computeRunMetrics, computeGlobalMetrics } from "../metrics/metrics-collector.ts";
import { buildReplayEnvelope } from "../replay/replay-serializer.ts";

export function createExecutionHistoryRouter(): Router {
  const router = Router();

  // ── List executions ────────────────────────────────────────────────────────
  router.get("/", async (req: Request, res: Response) => {
    try {
      const rows = await queryExecutions({
        runId:     req.query["runId"]     as string | undefined,
        projectId: req.query["projectId"] ? Number(req.query["projectId"]) : undefined,
        toolName:  req.query["toolName"]  as string | undefined,
        status:    req.query["status"]    as string | undefined,
        limit:     req.query["limit"]     ? Number(req.query["limit"]) : 50,
        offset:    req.query["offset"]    ? Number(req.query["offset"]) : 0,
        since:     req.query["since"]     ? new Date(req.query["since"] as string) : undefined,
        until:     req.query["until"]     ? new Date(req.query["until"] as string) : undefined,
      });
      res.json({ ok: true, count: rows.length, executions: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── Single execution ───────────────────────────────────────────────────────
  router.get("/:executionId", async (req: Request, res: Response) => {
    const { executionId } = req.params;
    // Skip if it matches sub-routes
    if (executionId === "metrics") return res.status(404).json({ ok: false, error: "use /metrics/global" }) as any;

    try {
      const row = await getExecutionById(executionId);
      if (!row) return res.status(404).json({ ok: false, error: "Execution not found" }) as any;
      res.json({ ok: true, execution: row });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── Run timeline ───────────────────────────────────────────────────────────
  router.get("/run/:runId/timeline", async (req: Request, res: Response) => {
    try {
      const rows     = await getRunTimeline(req.params.runId);
      const timeline = buildTimeline(req.params.runId, rows);
      res.json({ ok: true, timeline });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── Run metrics ────────────────────────────────────────────────────────────
  router.get("/run/:runId/metrics", async (req: Request, res: Response) => {
    try {
      const rows       = await getRunTimeline(req.params.runId);
      const runMetrics = computeRunMetrics(req.params.runId, rows);
      const toolStats  = computeToolMetrics(rows);
      res.json({ ok: true, run: runMetrics, tools: toolStats });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── Global metrics ─────────────────────────────────────────────────────────
  router.get("/metrics/global", async (req: Request, res: Response) => {
    try {
      const projectId = req.query["projectId"] ? Number(req.query["projectId"]) : undefined;
      const rows      = await queryExecutions({ projectId, limit: 5000 });
      const global    = computeGlobalMetrics(rows);
      const byTool    = computeToolMetrics(rows);
      res.json({ ok: true, global, byTool });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── Replay envelope ────────────────────────────────────────────────────────
  router.get("/replay/:executionId", async (req: Request, res: Response) => {
    try {
      const row = await getExecutionById(req.params.executionId);
      if (!row) return res.status(404).json({ ok: false, error: "Execution not found" }) as any;
      const envelope = buildReplayEnvelope({
        executionId: row.executionId,
        runId:       row.runId,
        toolName:    row.toolName,
        stepIndex:   row.stepIndex,
        argsJson:    row.argsJson,
        resultJson:  row.resultJson,
        status:      row.status,
        durationMs:  row.durationMs,
        startedAt:   row.startedAt,
        retryCount:  row.retryCount,
        replaySafe:  row.replaySafe,
      });
      res.json({ ok: true, replay: envelope });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  return router;
}
