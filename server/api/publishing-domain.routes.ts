/**
 * server/api/publishing-domain.routes.ts
 *
 * Domain management routes: list, add, remove, retry.
 * Single responsibility: domain CRUD only.
 */

import { Router, type Request, type Response } from "express";
import { domainManager, getDnsRecords } from "../publishing/index.ts";

export function createDomainRouter(): Router {
  const router = Router();

  router.get("/deployments/:projectId/domains", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      res.json({ ok: true, domains: await domainManager.listDomains(projectId) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post("/deployments/:projectId/domains", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const { name } = req.body as { name: string };
      if (!name) return res.status(400).json({ ok: false, error: "name is required" });
      const result = await domainManager.addDomain(projectId, name);
      if ("err" in result) return res.status(400).json({ ok: false, error: result.err });
      res.json({ ok: true, domain: result, dnsRecords: getDnsRecords(result.name) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete("/deployments/:projectId/domains/:domainId", async (req: Request, res: Response) => {
    try {
      const ok = await domainManager.removeDomain(Number(req.params.projectId), Number(req.params.domainId));
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post("/deployments/:projectId/domains/:domainId/retry", async (req: Request, res: Response) => {
    try {
      const ok = await domainManager.retryDomain(Number(req.params.projectId), Number(req.params.domainId));
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
}
