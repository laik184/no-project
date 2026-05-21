/**
 * server/api/fail-closed.routes.ts
 *
 * HTTP API for the fail-closed verification system.
 *
 * POST /api/verify/:projectId/propose
 *   Submit a CompletionProposal and run the full fail-closed pipeline.
 *   Body: { runId, proposedBy, claimedPostconditions[], workspacePath?, port?, previewUrl?, skipStages? }
 *   Returns: { ok, authorized, verdict, auditSummary, stageResults }
 *
 * POST /api/verify/:projectId/quick
 *   Run only STATIC+BUILD stages (fast check, no runtime).
 *   Returns: { ok, stageResults, passed }
 *
 * GET  /api/verify/:projectId/evidence-requirements
 *   Returns the required evidence kinds per verification stage.
 *
 * GET  /api/verify/:projectId/states
 *   Returns the state graph for the verification state machine.
 */

import { Router, type Request, type Response } from "express";
import { runFailClosed }       from "../fail-closed/index.ts";
import { EvidenceGate }        from "../fail-closed/gates/evidence-gate.ts";
import { PIPELINE_STAGES, TRANSITIONS } from "../fail-closed/state-machine/states.ts";
import type { VerificationStage, FailClosedRunOptions } from "../fail-closed/contracts/types.ts";
import { runtimeManager }      from "../infrastructure/runtime/runtime-manager.ts";

export function createFailClosedRouter(): Router {
  const r = Router();

  // ── Full fail-closed pipeline ─────────────────────────────────────────────
  r.post("/:projectId/propose", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) { res.status(400).json({ ok: false, error: "Invalid projectId" }); return; }

    const {
      runId = `run_${Date.now()}`,
      proposedBy = "agent",
      claimedPostconditions = [],
      workspacePath,
      port,
      previewUrl,
      skipStages,
      maxRetries = 2,
      timeoutMs  = 120_000,
    } = req.body;

    const entry = runtimeManager.get(projectId);
    const resolvedPath = workspacePath ?? entry?.cwd ?? process.cwd();
    const resolvedPort = port ?? entry?.port;

    const opts: FailClosedRunOptions = {
      projectId,
      workspacePath: resolvedPath,
      runId,
      port:          resolvedPort,
      previewUrl,
      skipStages:    skipStages as VerificationStage[] | undefined,
      maxRetries,
      timeoutMs,
      signal:        AbortSignal.timeout(timeoutMs),
    };

    const proposal = {
      proposedBy:             String(proposedBy),
      projectId,
      runId,
      timestamp:              Date.now(),
      claimedPostconditions:  Array.isArray(claimedPostconditions) ? claimedPostconditions : [],
      workspacePath:          resolvedPath,
      port:                   resolvedPort,
      previewUrl,
    };

    try {
      const result = await runFailClosed(opts, proposal);
      const auditSummary = result.audit.summary();

      res.status(result.ok ? 200 : 422).json({
        ok:           result.ok,
        authorized:   result.verdict.authorized,
        verdict:      result.verdict,
        auditSummary,
        stageResults: result.audit.getAll().map((e) => ({
          kind: e.kind, stage: e.stage, detail: e.detail, timestamp: e.timestamp,
        })),
        ...(result.ok ? {} : { halted: (result as any).halted }),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // ── Quick static+build check (no runtime) ────────────────────────────────
  r.post("/:projectId/quick", async (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) { res.status(400).json({ ok: false, error: "Invalid projectId" }); return; }

    const { workspacePath, runId = `quick_${Date.now()}` } = req.body;
    const entry = runtimeManager.get(projectId);
    const resolvedPath = workspacePath ?? entry?.cwd ?? process.cwd();

    const opts: FailClosedRunOptions = {
      projectId, workspacePath: resolvedPath, runId,
      skipStages: ["RUNTIME", "PREVIEW", "STATE_RECONCILIATION"],
      maxRetries: 0, timeoutMs: 60_000, signal: AbortSignal.timeout(60_000),
    };
    const proposal = {
      proposedBy: "quick-check", projectId, runId, timestamp: Date.now(),
      claimedPostconditions: [], workspacePath: resolvedPath,
    };

    try {
      const result = await runFailClosed(opts, proposal);
      res.status(200).json({
        ok:           result.stageResults.every((s) => s.passed),
        stageResults: result.stageResults.map((s) => ({
          stage: s.stage, passed: s.passed, failureReason: s.failureReason, durationMs: s.durationMs,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // ── Evidence requirements ─────────────────────────────────────────────────
  r.get("/:projectId/evidence-requirements", (_req: Request, res: Response) => {
    const gate = new EvidenceGate();
    const requirements: Record<string, readonly string[]> = {};
    for (const stage of PIPELINE_STAGES) {
      requirements[stage] = gate.requiredFor(stage as VerificationStage);
    }
    res.json({ ok: true, stages: PIPELINE_STAGES, requirements });
  });

  // ── State graph ───────────────────────────────────────────────────────────
  r.get("/:projectId/states", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      states:      Object.keys(TRANSITIONS),
      transitions: TRANSITIONS,
      pipeline:    PIPELINE_STAGES,
    });
  });

  return r;
}
