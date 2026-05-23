/**
 * server/api/publishing-deploy.routes.ts
 *
 * Deployment lifecycle routes: status, publish, list, current.
 * Single responsibility: deploy + deployment listing only.
 */

import { Router, type Request, type Response } from "express";
import { db }                        from "../infrastructure/db/index.ts";
import { projects }                  from "../../shared/schema.ts";
import { eq }                        from "drizzle-orm";
import { startDeployment, getDeployment, listDeployments } from "../publishing/index.ts";
import { settingsStore }             from "../publishing/index.ts";

export function createDeployRouter(): Router {
  const router = Router();

  router.get("/status/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
      const deploys = await listDeployments(projectId);
      const current = deploys[deploys.length - 1] ?? null;
      res.json({ ok: true, projectId, status: current?.status ?? "idle", deployment: current });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post("/publish/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
      const settings = await settingsStore.getSettings(projectId);
      const deployment = await startDeployment(projectId, {
        appName: settings.appName, region: settings.region, environment: settings.environment,
      });
      res.json({ ok: true, deployment });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get("/deployments/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      res.json({ ok: true, deployments: await listDeployments(projectId) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get("/deployments/:projectId/current", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const deploys = await listDeployments(projectId);
      res.json({ ok: true, deployment: deploys[deploys.length - 1] ?? null });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get("/deployments/:deploymentId/logs", (req: Request, res: Response) => {
    try {
      const deploymentId = Number(req.params.deploymentId);
      const { level, search, limit, offset } = req.query as Record<string, string>;
      const { logStore } = require("../publishing/index.ts");
      const entries = logStore.query(deploymentId, {
        level: level as any, search,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      res.json({ ok: true, logs: entries, counts: logStore.levelCounts(deploymentId) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get("/deployments/:deploymentId/resources", (req: Request, res: Response) => {
    try {
      const deploymentId = Number(req.params.deploymentId);
      const { metricsCollector } = require("../publishing/index.ts");
      const range = (req.query.range as any) ?? "5m";
      res.json({ ok: true, range, metrics: metricsCollector.getMetrics(deploymentId, range), current: metricsCollector.getCurrentStats(deploymentId) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
}
