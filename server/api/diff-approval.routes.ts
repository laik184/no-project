/**
 * server/api/diff-approval.routes.ts
 *
 * REST API for the diff approval system.
 *
 * POST /api/approvals/:sessionId/approve  — approve a pending diff
 * POST /api/approvals/:sessionId/reject   — reject a pending diff
 * GET  /api/approvals/pending             — list all pending approvals
 * GET  /api/approvals/pending/:projectId  — list pending for one project
 */

import { Router, type Request, type Response } from "express";
import { approve, reject }         from "../approvals/diff-approval.service.ts";
import { getPendingForProject, getAllPending } from "../approvals/diff-session.store.ts";

export function createDiffApprovalRouter(): Router {
  const router = Router();

  router.post("/:sessionId/approve", async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const result = await approve(sessionId);
    if ("error" in result) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, ...result });
  });

  router.post("/:sessionId/reject", async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const result = await reject(sessionId);
    if ("error" in result) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, ...result });
  });

  router.get("/pending", (_req: Request, res: Response) => {
    res.json({ ok: true, pending: getAllPending() });
  });

  router.get("/pending/:projectId", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ ok: false, error: "Invalid projectId" });
    }
    res.json({ ok: true, pending: getPendingForProject(projectId) });
  });

  return router;
}
