/**
 * orchestration.routes.ts
 *
 * REST API for the orchestration layer.
 * Exposes run management, debug, metrics, traces, health endpoints,
 * AND the master orchestrator hub registry (list, invoke, status, find).
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
import { orchestratorHub, getMasterStats, masterFindByCapability, masterFindByDomain } from "./registry/index.ts";
import type { OrchestratorDomain }  from "./registry/index.ts";

export function createOrchestrationRouter(): Router {
  const router = Router();

  // ── Health ─────────────────────────────────────────────────────────────────

  router.get("/health", (_req, res) => {
    const check     = orchestrationHealthCheck();
    const hubStatus = orchestratorHub.status();
    res.status(check.status === "unhealthy" ? 503 : 200).json({
      ok: true,
      ...check,
      hub: {
        initialized:  hubStatus.initialized,
        integrityOk:  hubStatus.integrityOk,
        healthy:      orchestratorHub.isHealthy,
        total:        hubStatus.totalRegistered,
        uptime:       hubStatus.uptime,
      },
    });
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

  // ══════════════════════════════════════════════════════════════════════════
  // MASTER ORCHESTRATOR HUB — Registry & Control Endpoints
  // ══════════════════════════════════════════════════════════════════════════

  // ── Hub Status ─────────────────────────────────────────────────────────────

  router.get("/hub/status", (_req, res) => {
    const status = orchestratorHub.status();
    res.json({
      ok:      true,
      hub:     status,
      healthy: orchestratorHub.isHealthy,
      invokes: orchestratorHub.invokeCount,
      errors:  orchestratorHub.errorCount,
    });
  });

  // ── Hub Stats ──────────────────────────────────────────────────────────────

  router.get("/hub/stats", (_req, res) => {
    const stats = getMasterStats();
    res.json({ ok: true, stats });
  });

  // ── Registry — List all orchestrators ────────────────────────────────────

  router.get("/hub/registry", (req, res) => {
    const domain = req.query.domain as OrchestratorDomain | undefined;
    const group  = req.query.group as any;
    const list   = orchestratorHub.list({ domain, group });
    res.json({ ok: true, orchestrators: list, total: list.length });
  });

  // ── Registry — Find by capability ─────────────────────────────────────────

  router.get("/hub/find", (req, res) => {
    const capability = req.query.capability as string;
    const domain     = req.query.domain as OrchestratorDomain | undefined;

    if (!capability && !domain) {
      return res.status(400).json({ ok: false, error: "Provide ?capability=... or ?domain=..." });
    }

    let results = capability
      ? masterFindByCapability(capability)
      : masterFindByDomain(domain!);

    res.json({ ok: true, results, total: results.length });
  });

  // ── Registry — Get single orchestrator ────────────────────────────────────

  router.get("/hub/registry/:id(*)", (req, res) => {
    const entry = orchestratorHub.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ ok: false, error: `Orchestrator "${req.params.id}" not found` });
    }
    res.json({
      ok: true,
      orchestrator: {
        id:           entry.id,
        domain:       entry.domain,
        description:  entry.description,
        capabilities: entry.capabilities,
      },
    });
  });

  // ── Hub — Invoke any orchestrator ─────────────────────────────────────────

  router.post("/hub/invoke/:id(*)", async (req, res) => {
    const { id } = req.params;
    const input  = req.body;

    const result = await orchestratorHub.invoke(id, input);

    res.status(result.success ? 200 : 502).json({ ok: result.success, ...result });
  });

  // ── Hub — Batch invoke ────────────────────────────────────────────────────

  router.post("/hub/invoke-batch", async (req, res) => {
    const { requests } = req.body;

    if (!Array.isArray(requests)) {
      return res.status(400).json({ ok: false, error: "requests must be an array of { id, input }" });
    }

    const results = await orchestratorHub.invokeBatch(requests);
    const succeeded = results.filter((r) => r.success).length;

    res.json({
      ok:        succeeded > 0,
      total:     results.length,
      succeeded,
      failed:    results.length - succeeded,
      results,
    });
  });

  return router;
}
