/**
 * preview-routes.ts — Express router wiring for all preview API endpoints.
 */

import { Router } from "express";
import {
  getPreviewState,
  getPreviewHealth,
  getPreviewSession,
  postPreviewReload,
  postPreviewStart,
  postPreviewStop,
  postPreviewLifecycle,
  postDevtoolsConsole,
  postDevtoolsNetwork,
  getDevtools,
  getPreviewMetrics,
  getLifecycleState,
} from "./preview-controller.ts";
import { handlePreviewStream } from "./preview-stream-endpoint.ts";

export function buildPreviewRouter(): Router {
  const router = Router();

  // ── State & Health ──────────────────────────────────────────────────────────
  router.get("/state",             getPreviewState);
  router.get("/state/:projectId",  getPreviewState);
  router.get("/health",            getPreviewHealth);
  router.get("/health/:projectId", getPreviewHealth);

  // ── Metrics (used by useRuntimeHealth hook — polls every 5 s) ───────────────
  router.get("/metrics",            getPreviewMetrics);
  router.get("/metrics/:projectId", getPreviewMetrics);

  // ── Sessions ────────────────────────────────────────────────────────────────
  router.get("/session/:id",    getPreviewSession);

  // ── Actions ─────────────────────────────────────────────────────────────────
  router.post("/reload",        postPreviewReload);
  router.post("/start",         postPreviewStart);
  router.post("/stop",          postPreviewStop);
  router.post("/lifecycle",     postPreviewLifecycle);

  // ── DevTools ────────────────────────────────────────────────────────────────
  router.get("/devtools",          getDevtools);
  router.post("/devtools/console", postDevtoolsConsole);
  router.post("/devtools/network", postDevtoolsNetwork);

  // ── SSE Stream ──────────────────────────────────────────────────────────────
  router.get("/stream",         handlePreviewStream);

  return router;
}
