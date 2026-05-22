/**
 * dag.routes.ts
 *
 * HTTP API for DAG execution observability and control.
 * Exposes live graph state, metrics, checkpoints, and replay triggers.
 *
 * Mounted at: /api/dag
 * Single responsibility: HTTP routing. No execution logic.
 */

import { Router, type Request, type Response } from "express";
import { graphStateStore }    from "../engine/state/graph-state-store.ts";
import { dagCheckpointStore } from "../engine/checkpoints/dag-checkpoint-store.ts";
import { getRunMetrics, getAllMetrics } from "../engine/telemetry/dag-metrics.ts";
import { serializeGraph }     from "../engine/graph/graph-state.ts";
import { schedulerSnapshot }  from "../engine/scheduler/dag-scheduler.ts";
import { runDagFromPlan }     from "../engine/execution/dag-execution-coordinator.ts";
import { agentPromiseRegistry } from "../engine/execution/agent-promise-registry.ts";
import type { ExecutionPlanInput } from "../engine/dag/dag-node-builder.ts";

export function createDagRouter(): Router {
  const router = Router();

  // ── GET /api/dag/graphs ───────────────────────────────────────────────────
  // List all active/recent graphs (state store snapshot)
  router.get("/graphs", (_req: Request, res: Response) => {
    const snapshot = graphStateStore.snapshot();
    const graphs   = graphStateStore.list().map(g => ({
      id:           g.id,
      projectId:    g.projectId,
      goal:         g.goal,
      status:       g.status,
      nodes:        g.nodes.size,
      completed:    g.completedIds.size,
      failed:       g.failedIds.size,
      currentWave:  g.currentWave,
      createdAt:    g.createdAt,
      startedAt:    g.startedAt,
      completedAt:  g.completedAt,
    }));
    res.json({ ok: true, ...snapshot, graphs });
  });

  // ── GET /api/dag/:runId/graph ─────────────────────────────────────────────
  // Full graph state for a specific run
  router.get("/:runId/graph", (req: Request, res: Response) => {
    const { runId } = req.params;
    const graph = graphStateStore.get(runId);
    if (!graph) {
      return res.status(404).json({ ok: false, error: `Graph not found: ${runId}` });
    }

    const serialized = JSON.parse(serializeGraph(graph));
    const schedule   = schedulerSnapshot(graph);

    res.json({ ok: true, graph: serialized, schedule });
  });

  // ── GET /api/dag/:runId/nodes ─────────────────────────────────────────────
  // Node list with current status (lighter than full graph)
  router.get("/:runId/nodes", (req: Request, res: Response) => {
    const { runId } = req.params;
    const graph = graphStateStore.get(runId);
    if (!graph) {
      return res.status(404).json({ ok: false, error: `Graph not found: ${runId}` });
    }

    const nodes = [...graph.nodes.values()].map(n => ({
      id:          n.id,
      label:       n.label,
      type:        n.type,
      status:      n.status,
      retryCount:  n.retryCount,
      maxRetries:  n.maxRetries,
      dependsOn:   n.dependsOn,
      durationMs:  n.durationMs,
      startedAt:   n.startedAt,
      completedAt: n.completedAt,
      error:       n.error,
      isCheckpoint:n.isCheckpoint,
    }));

    res.json({ ok: true, runId, nodes, total: nodes.length });
  });

  // ── GET /api/dag/:runId/metrics ───────────────────────────────────────────
  // Run-level execution metrics
  router.get("/:runId/metrics", (req: Request, res: Response) => {
    const { runId } = req.params;
    const metrics = getRunMetrics(runId);
    if (!metrics) {
      return res.status(404).json({ ok: false, error: `No metrics for run: ${runId}` });
    }
    res.json({ ok: true, metrics });
  });

  // ── GET /api/dag/metrics ──────────────────────────────────────────────────
  // All stored run metrics
  router.get("/metrics", (_req: Request, res: Response) => {
    const all = getAllMetrics();
    res.json({ ok: true, count: all.length, metrics: all });
  });

  // ── GET /api/dag/:runId/checkpoints ───────────────────────────────────────
  // List checkpoints for a run
  router.get("/:runId/checkpoints", (req: Request, res: Response) => {
    const { runId } = req.params;
    const entries = dagCheckpointStore.listForRun(runId).map(e => ({
      checkpointId: e.checkpointId,
      runId:        e.runId,
      projectId:    e.projectId,
      savedAt:      e.savedAt,
      checkpointAt: e.checkpoint.checkpointAt,
      totalNodes:   e.checkpoint.nodeSnapshots.length,
      completedIds: e.checkpoint.completedIds.length,
    }));
    res.json({ ok: true, runId, count: entries.length, checkpoints: entries });
  });

  // ── GET /api/dag/checkpoints/store ────────────────────────────────────────
  // Checkpoint store snapshot
  router.get("/checkpoints/store", (_req: Request, res: Response) => {
    res.json({ ok: true, ...dagCheckpointStore.snapshot() });
  });

  // ── GET /api/dag/agents/registry ─────────────────────────────────────────
  // Agent promise registry status (how many agent nodes are awaiting completion)
  router.get("/agents/registry", (_req: Request, res: Response) => {
    res.json({ ok: true, pendingAgentNodes: agentPromiseRegistry.size() });
  });

  // ── POST /api/dag/agents/:key/resolve ─────────────────────────────────────
  // Resolve an agent node promise externally (used by agent runners)
  router.post("/agents/:key/resolve", (req: Request, res: Response) => {
    const { key } = req.params;
    const result  = req.body?.result ?? { resolved: true };
    const resolved = agentPromiseRegistry.resolve(key, result);
    if (!resolved) {
      return res.status(404).json({ ok: false, error: `No pending agent node for key: ${key}` });
    }
    res.json({ ok: true, key, resolved: true });
  });

  // ── POST /api/dag/agents/:key/reject ──────────────────────────────────────
  // Reject an agent node promise externally (signal agent failure to DAG)
  router.post("/agents/:key/reject", (req: Request, res: Response) => {
    const { key }   = req.params;
    const reason    = req.body?.reason ?? "Agent rejected";
    const rejected  = agentPromiseRegistry.reject(key, new Error(reason));
    if (!rejected) {
      return res.status(404).json({ ok: false, error: `No pending agent node for key: ${key}` });
    }
    res.json({ ok: true, key, rejected: true });
  });

  // ── POST /api/dag/run ─────────────────────────────────────────────────────
  // Trigger a DAG run from an execution plan
  router.post("/run", async (req: Request, res: Response) => {
    const body = req.body as Partial<ExecutionPlanInput>;

    if (!body.goal || !body.projectId || !Array.isArray(body.tasks)) {
      return res.status(400).json({
        ok: false,
        error: "Required: goal (string), projectId (number), tasks (array)",
      });
    }

    const plan: ExecutionPlanInput = {
      goal:      body.goal,
      projectId: Number(body.projectId),
      tasks:     body.tasks,
      runId:     body.runId,
    };

    try {
      // Fire and return immediately with graph ID — client can poll /api/dag/:runId/graph
      res.json({ ok: true, message: "DAG run started", runId: plan.runId ?? "auto-assigned" });
      // Run asynchronously after response
      runDagFromPlan(plan).catch(err =>
        console.error(`[dag-routes] runDagFromPlan failed: ${err.message}`),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // ── GET /api/dag/:runId/schedule ──────────────────────────────────────────
  // Computed execution schedule (waves) for a graph
  router.get("/:runId/schedule", async (req: Request, res: Response) => {
    const { runId } = req.params;
    const graph = graphStateStore.get(runId);
    if (!graph) {
      return res.status(404).json({ ok: false, error: `Graph not found: ${runId}` });
    }

    const { buildSchedule } = await import("../engine/graph/node-scheduler.ts");
    const waves = buildSchedule(graph).map((w: any) => ({
      waveIndex:  w.waveIndex,
      isParallel: w.isParallel,
      nodes:      w.nodes.map((n: any) => ({ id: n.id, label: n.label, type: n.type })),
    }));

    res.json({ ok: true, runId, waves, totalWaves: waves.length });
  });

  return router;
}
