/**
 * server/api/checkpoints.routes.ts
 * REST API for checkpoint, rollback, and recovery operations.
 *
 * Checkpoints:
 *   GET    /api/checkpoints/:projectId               — list checkpoints
 *   POST   /api/checkpoints/:projectId               — create manual checkpoint
 *   GET    /api/checkpoints/:projectId/:id           — get checkpoint detail
 *   POST   /api/checkpoints/:projectId/:id/rollback  — rollback to checkpoint (with lock)
 *   POST   /api/checkpoints/:projectId/:id/validate  — integrity check
 *   POST   /api/checkpoints/:projectId/:id/restore-file — restore single file
 *
 * Run restore:
 *   POST   /api/checkpoints/run/:runId/restore       — undo entire run (with lock)
 *   GET    /api/checkpoints/:projectId/runs/restorable
 *
 * Snapshots:
 *   GET    /api/checkpoints/:projectId/:id/diff?compareId=  — diff two checkpoints
 *
 * Recovery:
 *   POST   /api/checkpoints/:projectId/safe-rollback — safe rollback with lock+guard
 *   POST   /api/checkpoints/:projectId/emergency     — emergency crash recovery
 *   GET    /api/checkpoints/:projectId/recovery/diagnostics
 *   POST   /api/checkpoints/:projectId/recovery/reset
 */

import { Router }                     from "express";
import { getProjectDir }              from "../infrastructure/sandbox/sandbox.util.ts";
import { checkpointStore }            from "../infrastructure/checkpoints/checkpoint.service.ts";
import { restoreFile }                from "../infrastructure/checkpoints/restore/restore-file.service.ts";
import { restoreRun, listRestorableRuns } from "../infrastructure/checkpoints/restore/restore-run.service.ts";
import { triggerEmergencyRecovery }   from "../infrastructure/checkpoints/restore/emergency-recovery.service.ts";
import { diffSnapshots, formatDiffSummary } from "../infrastructure/snapshots/snapshot-diff.ts";
import {
  safeRollback,
  undoRun,
  validateCheckpoint,
  getRecoveryDiagnostics,
  resetProject,
} from "../infrastructure/recovery/recovery-manager.ts";

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
    const meta = await checkpointStore.create({ projectId, sandboxRoot, trigger: "manual", label });
    return res.status(201).json({ ok: true, checkpoint: meta });
  });

  // ── Get single checkpoint ─────────────────────────────────────────────────
  router.get("/:projectId/:id", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const meta = await checkpointStore.get(projectId, req.params.id);
    if (!meta) return res.status(404).json({ ok: false, error: "Checkpoint not found" });
    return res.json({ ok: true, checkpoint: meta });
  });

  // ── Validate checkpoint integrity ─────────────────────────────────────────
  router.post("/:projectId/:id/validate", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const result = await validateCheckpoint(projectId, req.params.id);
    return res.status(result.valid ? 200 : 422).json({ ok: result.valid, ...result });
  });

  // ── Rollback to checkpoint (via recovery-manager lock + guard) ────────────
  router.post("/:projectId/:id/rollback", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });

    // Route through the recovery manager for lock + timeout safety
    const checkpointId = req.params.id;
    const sandboxRoot  = getProjectDir(projectId);

    // Import rollback directly (lock already handled by safeRollback wrapper)
    const { rollbackToCheckpoint } = await import(
      "../infrastructure/checkpoints/rollback.service.ts"
    );
    const result = await rollbackToCheckpoint({ checkpointId, projectId, sandboxRoot, scope: "full_run" });
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

  // ── Snapshot diff between two checkpoints ─────────────────────────────────
  router.get("/:projectId/:id/diff", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const compareId = req.query.compareId as string;
    if (!compareId) return res.status(400).json({ ok: false, error: "compareId query param required" });
    const diff    = await diffSnapshots(projectId, req.params.id, compareId);
    const summary = formatDiffSummary(diff);
    return res.json({ ok: true, diff, summary });
  });

  // ── Restore entire run (undo run) — with recovery-manager lock ────────────
  router.post("/run/:runId/restore", async (req, res) => {
    const { runId } = req.params;
    const projectId  = Number(req.body?.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "projectId required" });
    const result = await undoRun(runId, projectId);
    if ("skipped" in result) {
      return res.status(409).json({ ok: false, skipped: true, reason: result.reason });
    }
    return res.status(result.success ? 200 : 500).json({ ok: result.success, result });
  });

  // ── List restorable runs ──────────────────────────────────────────────────
  router.get("/:projectId/runs/restorable", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const runs = await listRestorableRuns(projectId);
    return res.json({ ok: true, runs });
  });

  // ── Safe rollback (locked + timeout guarded) ──────────────────────────────
  router.post("/:projectId/safe-rollback", async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    const result = await safeRollback(projectId);
    if ("skipped" in result) {
      return res.status(409).json({ ok: false, skipped: true, reason: result.reason });
    }
    return res.status(result.success ? 200 : 500).json({ ok: result.success, result });
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

  // ── Recovery diagnostics ──────────────────────────────────────────────────
  router.get("/:projectId/recovery/diagnostics", (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    return res.json({ ok: true, diagnostics: getRecoveryDiagnostics(projectId) });
  });

  // ── Reset recovery state (call after manual re-deploy) ───────────────────
  router.post("/:projectId/recovery/reset", (req, res) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ ok: false, error: "Invalid projectId" });
    resetProject(projectId);
    return res.json({ ok: true, message: `Recovery state reset for project ${projectId}` });
  });

  return router;
}
