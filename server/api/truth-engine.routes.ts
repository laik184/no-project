/**
 * server/api/truth-engine.routes.ts
 *
 * HTTP API for the Runtime Truth Engine.
 *
 * POST /api/truth/:projectId/verify
 *   Run the full deterministic verification pipeline for a project.
 *   Body: { port?, previewUrl?, skipStages? }
 *   Returns: VerificationReport (passed, stages, evidence, recovery signal)
 *
 * GET  /api/truth/:projectId/snapshot
 *   Returns the most recent verification snapshot for a project.
 *
 * GET  /api/truth/:projectId/state
 *   Returns the current RuntimeHealthState for a project.
 *
 * GET  /api/truth/evidence/:claim
 *   Evaluate a named evidence claim (e.g. "server_running", "typescript_valid").
 *
 * GET  /api/truth/events
 *   Returns recent runtime events from the event bus.
 */

import { Router, type Request, type Response } from "express";
import { getOrchestrator, runVerification, runtimeEventBus } from "../runtime-truth/index.ts";
import type { VerificationStage } from "../runtime-truth/types.ts";
import { runtimeManager } from "../infrastructure/runtime/runtime-manager.ts";

export function createTruthEngineRouter(): Router {
  const r = Router();

  // ── Full verification pipeline ─────────────────────────────────────────────

  r.post("/:projectId/verify", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) {
      res.status(400).json({ ok: false, error: "Invalid projectId" });
      return;
    }

    const { port, previewUrl, skipStages, workspacePath } = req.body as {
      port?: number;
      previewUrl?: string;
      skipStages?: VerificationStage[];
      workspacePath?: string;
    };

    // Resolve workspace path from runtime manager if not supplied
    const entry = runtimeManager.get(projectId);
    const resolvedWorkspace = workspacePath ?? entry?.cwd ?? process.cwd();
    const resolvedPort = port ?? entry?.port;

    try {
      const report = await runVerification({
        projectId,
        workspacePath: resolvedWorkspace,
        port: resolvedPort,
        previewUrl,
        skipStages,
        timeoutMs: 120_000,
      });

      res.status(report.passed ? 200 : 422).json({
        ok: report.passed,
        report: {
          correlationId: report.correlationId,
          passed: report.passed,
          state: report.state,
          durationMs: report.durationMs,
          timestamp: report.timestamp,
          stages: report.stages.map((s) => ({
            stage: s.stage,
            status: s.status,
            durationMs: s.durationMs,
            failureReason: s.failureReason,
          })),
          recoverySignal: report.recoverySignal
            ? {
                id: report.recoverySignal.id,
                reason: report.recoverySignal.reason,
                failedStage: report.recoverySignal.failedStage,
                recommendedActions: report.recoverySignal.recommendedActions,
              }
            : null,
        },
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // ── Latest snapshot ────────────────────────────────────────────────────────

  r.get("/:projectId/snapshot", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) {
      res.status(400).json({ ok: false, error: "Invalid projectId" });
      return;
    }

    const orchestrator = getOrchestrator();
    const snapshot = orchestrator.stateStore.lastSnapshot;

    if (!snapshot || snapshot.projectId !== projectId) {
      res.status(404).json({ ok: false, error: "No snapshot found for this project" });
      return;
    }

    res.json({ ok: true, snapshot });
  });

  // ── Current runtime state ──────────────────────────────────────────────────

  r.get("/:projectId/state", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) {
      res.status(400).json({ ok: false, error: "Invalid projectId" });
      return;
    }

    const orchestrator = getOrchestrator();
    const lastVerified = orchestrator.stateStore.lastVerifiedAt();

    res.json({
      ok: true,
      projectId,
      state: orchestrator.stateStore.state,
      stateVersion: orchestrator.stateStore.version,
      lastVerifiedAt: lastVerified,
      lastVerifiedAgo: lastVerified ? Date.now() - lastVerified : null,
    });
  });

  // ── Evidence claim evaluation ─────────────────────────────────────────────

  r.get("/evidence/:claim", (req: Request, res: Response) => {
    const { claim } = req.params;
    const orchestrator = getOrchestrator();
    const evaluation = orchestrator.evidenceBus;

    // Pull from the evidence collector on the orchestrator
    // (exposed via the state store's snapshot evidence)
    const snap = orchestrator.stateStore.lastSnapshot;
    const allEvidence = snap?.evidence ?? [];

    res.json({
      ok: true,
      claim,
      evidence: allEvidence,
      totalPieces: allEvidence.length,
    });
  });

  // ── Recent runtime events ─────────────────────────────────────────────────

  r.get("/events", (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const kind = req.query.kind as string | undefined;

    const events = kind
      ? runtimeEventBus.history(kind as any)
      : runtimeEventBus.history();

    res.json({
      ok: true,
      events: events.slice(-limit).map((e) => ({
        id: e.id,
        kind: e.kind,
        sequenceNo: e.sequenceNo,
        timestamp: e.timestamp,
        correlationId: e.correlationId,
        payload: e.payload,
      })),
      total: events.length,
    });
  });

  return r;
}
