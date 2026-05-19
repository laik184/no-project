/**
 * runtime-store/runtime-sync.ts
 *
 * SSE replay + HTTP snapshot endpoint helpers.
 *
 * Solves the "new client connects and sees stale state" problem:
 *   1. GET /api/runtime/state/:projectId  → returns full RuntimeSnapshot
 *      (frontend calls this on mount to hydrate before the SSE stream starts)
 *   2. replayToClient(res, projectId)     → writes current snapshot as an
 *      SSE "runtime.sync" event to a freshly-connected SSE client
 *
 * This module is stateless — all data comes from runtimeStore.get().
 */

import type { Request, Response } from "express";
import { Router }                  from "express";
import { runtimeStore }            from "./runtime-store.ts";
import { runtimeManager }          from "../runtime-manager.ts";
import { getLifecycleManager }     from "../../../preview/lifecycle/preview-lifecycle.manager.ts";
import type { RuntimeSnapshot }    from "./runtime-types.ts";

// ─── SSE replay helper ────────────────────────────────────────────────────────

/**
 * Write the current runtime snapshot as a "runtime.sync" SSE event.
 * Call this immediately after a client's SSE connection is accepted.
 */
export function replayToClient(res: Response, projectId: number): void {
  const snapshot = runtimeStore.get(projectId);
  const lifecycle = getLifecycleManager(projectId).getState();

  const payload = JSON.stringify({
    type:      "runtime.sync",
    projectId,
    snapshot,
    lifecycle,
    ts:        Date.now(),
  });

  try {
    res.write(`event: runtime.sync\ndata: ${payload}\n\n`);
  } catch {
    // Client already disconnected — ignore
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createRuntimeSyncRouter(): Router {
  const router = Router();

  /**
   * GET /api/runtime/state
   * Returns snapshots for ALL currently tracked projects.
   */
  router.get("/state", (_req: Request, res: Response) => {
    const all = runtimeStore.all();
    res.json({ ok: true, count: all.length, entries: all });
  });

  /**
   * GET /api/runtime/state/:projectId
   * Returns the full aggregated RuntimeSnapshot for one project.
   * Used by the frontend on mount for SSE hydration (cold-start).
   */
  router.get("/state/:projectId", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) {
      res.status(400).json({ ok: false, error: "Invalid projectId" });
      return;
    }

    const snapshot  = runtimeStore.get(projectId);
    const lifecycle = getLifecycleManager(projectId).getState();
    const procEntry = runtimeManager.get(projectId);

    res.json({
      ok: true,
      projectId,
      snapshot,
      lifecycle,
      running:  !!procEntry && (procEntry.status === "running" || procEntry.status === "starting"),
      port:     procEntry?.port,
    });
  });

  /**
   * GET /api/runtime/health
   * Quick health roll-up for all tracked projects.
   */
  router.get("/health", (_req: Request, res: Response) => {
    const all = runtimeStore.all();
    const healthy   = all.filter(s => s.healthy).length;
    const crashed   = all.filter(s => s.phase === "crashed").length;
    const starting  = all.filter(s => s.phase === "starting" || s.phase === "verifying").length;

    res.json({ ok: true, total: all.length, healthy, crashed, starting });
  });

  return router;
}
