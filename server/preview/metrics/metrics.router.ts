/**
 * metrics.router.ts — runtime observability endpoints.
 *
 * GET /api/preview/metrics            → all running projects
 * GET /api/preview/metrics/:projectId → single project snapshot
 */

import { Router } from "express";
import { getProjectMetrics, getAllMetrics } from "./metrics.service.ts";

const router = Router();

router.get("/preview/metrics", (_req, res) => {
  const metrics = getAllMetrics();
  res.json({ ok: true, metrics, count: metrics.length });
});

router.get("/preview/metrics/:projectId", (req, res) => {
  const id = parseInt(req.params.projectId, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: "Invalid projectId" });
  }

  const metrics = getProjectMetrics(id);
  if (!metrics) {
    return res.status(404).json({ ok: false, error: "No running process for this project" });
  }

  res.json({ ok: true, metrics });
});

export default router;
