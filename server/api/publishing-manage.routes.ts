/**
 * server/api/publishing-manage.routes.ts
 *
 * Runtime management routes: status, restart, redeploy, shutdown.
 * Single responsibility: live deployment control only.
 */

import { Router, type Request, type Response } from "express";
import { getDeployment, runtimeStatus } from "../publishing/index.ts";

export function createManageRouter(): Router {
  const router = Router();

  router.get("/deployments/:deploymentId/manage/status", (req: Request, res: Response) => {
    res.json({ ok: true, ...runtimeStatus.getStatus(Number(req.params.deploymentId)) });
  });

  router.post("/deployments/:deploymentId/manage/restart", (req: Request, res: Response) => {
    runtimeStatus.restart(Number(req.params.deploymentId));
    res.json({ ok: true, action: "restart" });
  });

  router.post("/deployments/:deploymentId/manage/redeploy", async (req: Request, res: Response) => {
    try {
      const deploymentId = Number(req.params.deploymentId);
      const existing = await getDeployment(deploymentId);
      if (!existing) return res.status(404).json({ ok: false, error: "Deployment not found" });
      runtimeStatus.redeploy(deploymentId);
      res.json({ ok: true, action: "redeploy" });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post("/deployments/:deploymentId/manage/shutdown", (req: Request, res: Response) => {
    runtimeStatus.shutdown(Number(req.params.deploymentId));
    res.json({ ok: true, action: "shutdown" });
  });

  return router;
}
