/**
 * server/api/checkpoints.routes.ts
 * REST API for checkpoint and rollback operations.
 *
 * GET    /api/checkpoints/:projectId          — list checkpoints
 * POST   /api/checkpoints/:projectId          — create manual checkpoint
 * GET    /api/checkpoints/:projectId/:id      — get checkpoint detail
 * POST   /api/checkpoints/:projectId/:id/rollback     — rollback to checkpoint
 * POST   /api/checkpoints/:projectId/:id/restore-file — restore single file
 * POST   /api/checkpoints/run/:runId/restore  — restore entire run (undo run)
 * GET    /api/checkpoints/:projectId/runs     — list restorable runs
 * POST   /api/checkpoints/:projectId/emergency — emergency recovery
 */

import { Router }                    from "express";
import { getProjectDir }             from "../infrastructure/sandbox/sandbox.util.ts";
import { checkpointStore }           from "../infrastructure/checkpoints/checkpoint.service.ts";
import { rollbackToCheckpoint }      from "../infrastructure/checkpoints/rollback.service.ts";
import { restoreFile }               from "../infrastructure/checkpoints/restore/restore-file.service.ts";
import { restoreRun, listRestorableRuns } from "../infrastructure/checkpoints/restore/restore-run.service.ts";
import { triggerEmergencyRecovery }  from "../infrastructure/checkpoints/restore/emergency-recovery.service.ts";

export function createCheckpointsRouter(): Router {
  const router = Router();

  // ── List checkpoints for a project ────────────────────────────────────────
  router.get("/:projectId", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const list = await checkpointStore.listForProject(projectId);
    return res.json({ ok: true, checkpoints: list });
  });

  // ── Create a manual checkpoint ────────────────────────────────────────────
  router.post("/:projectId", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const sandboxRoot = getProjectDir(projectId);
    const label       = (req.body?.label as string) || "manual";
    const meta = await checkpointStore.create({
      projectId,
      sandboxRoot,
      trigger: "manual",
      label,
    });
    return res.status(201).json({ ok: true, checkpoint: meta });
  });

  // ── Get single checkpoint ─────────────────────────────────────────────────
  router.get("/:projectId/:id", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const meta = await checkpointStore.get(projectId, req.params.id);
    if (!meta) return res.status(404).json({ ok: false, error: "Checkpoint not found" });
    return res.json({ ok: true, checkpoint: meta });
  });

  // ── Rollback to checkpoint ────────────────────────────────────────────────
  router.post("/:projectId/:id/rollback", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const sandboxRoot = getProjectDir(projectId);
    const result = await rollbackToCheckpoint({
      checkpointId: req.params.id,
      projectId,
      sandboxRoot,
      scope: "full_run",
    });
    return res.status(result.success ? 200 : 500).json({ ok: result.success, result });
  });

  // ── Restore single file ───────────────────────────────────────────────────
  router.post("/:projectId/:id/restore-file", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const filePath = req.body?.filePath as string;
    if (!filePath) return res.status(400).json({ ok: false, error: "filePath required" });
    const sandboxRoot = getProjectDir(projectId);
    const result = await restoreFile(projectId, req.params.id, sandboxRoot, filePath);
    return res.status(result.success ? 200 : 500).json({ ok: result.success, result });
  });

  // ── Restore entire run ────────────────────────────────────────────────────
  router.post("/run/:runId/restore", async (req, res) => {
    const { runId } = req.params;
    const projectId = Number(req.body?.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "projectId required" });
    const result = await restoreRun(runId, projectId);
    return res.status(result.success ? 200 : 500).json({ ok: result.success, result });
  });

  // ── List restorable runs ──────────────────────────────────────────────────
  router.get("/:projectId/runs/restorable", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const runs = await listRestorableRuns(projectId);
    return res.json({ ok: true, runs });
  });

  // ── Emergency recovery ────────────────────────────────────────────────────
  router.post("/:projectId/emergency", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const result = await triggerEmergencyRecovery(
      projectId,
      req.body?.runId,
      req.body?.reason || "manual emergency recovery",
    );
    return res.status(result.success ? 200 : 500).json({ ok: result.success, result });
  });

  return router;
}
