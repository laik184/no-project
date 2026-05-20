/**
 * orchestration.routes.ts
 *
 * REST API for the orchestration layer.
 * Exposes run management, debug, metrics, traces, and health endpoints.
 */

import { Router }                   from "express";
import { executeOrchestration }     from "./core/orchestration-engine.ts";
import { getState, allStates }      from "./core/orchestration-state.ts";
import { listCheckpoints }          from "./core/orchestration-replay.ts";
import { captureDebugSnapshot, buildRunTimeline, orchestrationHealthCheck } from "./telemetry/orchestration-debug.ts";
import { snapshotMetrics, orchestrationHealthSummary } from "./telemetry/orchestration-metrics.ts";
import { getRunTrace, traceStats }  from "./telemetry/orchestration-trace.ts";
import { queryLogs }                from "./telemetry/orchestration-logs.ts";
import { getEngineVersion }         from "./core/orchestration-engine.ts";

export function createOrchestrationRouter(): Router {
  const router = Router();

  // ── Health ─────────────────────────────────────────────────────────────────

  router.get("/health", (_req, res) => {
    const check = orchestrationHealthCheck();
    res.status(check.status === "unhealthy" ? 503 : 200).json({ ok: true, ...check });
  });

  router.get("/version", (_req, res) => {
    res.json({ version: getEngineVersion(), ts: Date.now() });
  });

  // ── Run management ─────────────────────────────────────────────────────────

  router.post("/runs", async (req, res) => {
    const { runId, projectId, goal, mode, sessionId, parentRunId, maxSteps, maxRetries, metadata } = req.body;

    if (!runId || !projectId || !goal) {
      return res.status(400).json({ ok: false, error: "runId, projectId, and goal are required" });
    }

    // Fire-and-forget — orchestration is async
    executeOrchestration({ runId, projectId, goal, mode: mode ?? "tool-loop", sessionId, parentRunId, maxSteps, maxRetries, metadata })
      .catch(err => console.error(`[orchestration.routes] Run ${runId} failed: ${err}`));

    res.status(202).json({ ok: true, runId, status: "accepted" });
  });

  router.get("/runs", (_req, res) => {
    const states = allStates();
    res.json({ ok: true, runs: states, total: states.length });
  });

  router.get("/runs/:runId", (req, res) => {
    const state = getState(req.params.runId);
    if (!state) return res.status(404).json({ ok: false, error: "Run not found" });
    res.json({ ok: true, state });
  });

  router.get("/runs/:runId/timeline", (req, res) => {
    const timeline = buildRunTimeline(req.params.runId);
    if (!timeline) return res.status(404).json({ ok: false, error: "Run timeline not found" });
    res.json({ ok: true, timeline });
  });

  router.get("/runs/:runId/checkpoints", (req, res) => {
    const checkpoints = listCheckpoints(req.params.runId);
    res.json({ ok: true, checkpoints, total: checkpoints.length });
  });

  router.get("/runs/:runId/trace", (req, res) => {
    const spans = getRunTrace(req.params.runId);
    res.json({ ok: true, spans, total: spans.length });
  });

  router.get("/runs/:runId/logs", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs  = queryLogs({ runId: req.params.runId, limit });
    res.json({ ok: true, logs, total: logs.length });
  });

  // ── Metrics ────────────────────────────────────────────────────────────────

  router.get("/metrics", (_req, res) => {
    const snapshot = snapshotMetrics();
    const summary  = orchestrationHealthSummary();
    res.json({ ok: true, summary, ...snapshot });
  });

  // ── Debug ──────────────────────────────────────────────────────────────────

  router.get("/debug", (_req, res) => {
    const snapshot = captureDebugSnapshot();
    res.json({ ok: true, snapshot });
  });

  router.get("/debug/traces", (_req, res) => {
    const stats = traceStats();
    res.json({ ok: true, stats });
  });

  // ── Logs ───────────────────────────────────────────────────────────────────

  router.get("/logs", (req, res) => {
    const limit     = parseInt(req.query.limit as string) || 200;
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const level     = req.query.level as any;
    const logs      = queryLogs({ projectId, level, limit });
    res.json({ ok: true, logs, total: logs.length });
  });

  return router;
}
