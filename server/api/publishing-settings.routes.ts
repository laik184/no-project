/**
 * server/api/publishing-settings.routes.ts
 *
 * Settings, secrets, and auth configuration routes.
 * Single responsibility: project configuration management only.
 */

import { Router, type Request, type Response } from "express";
import { settingsStore, authConfigStore, securityScanner, issueStore } from "../publishing/index.ts";
import type { IssueState, AuthProvider } from "../publishing/types.ts";

export function createSettingsRouter(): Router {
  const router = Router();

  // ── Security scan ──────────────────────────────────────────────────────────
  router.get("/deployments/:deploymentId/security-scan", (req: Request, res: Response) => {
    res.json({ ok: true, scan: securityScanner.getScanResult(Number(req.params.deploymentId)) });
  });

  router.post("/deployments/:deploymentId/security-scan", (req: Request, res: Response) => {
    const deploymentId = Number(req.params.deploymentId);
    if (securityScanner.isScanning(deploymentId))
      return res.status(409).json({ ok: false, error: "Scan already in progress" });
    securityScanner.runScan(deploymentId, () => {});
    res.json({ ok: true, message: "Scan started" });
  });

  router.patch("/deployments/:deploymentId/security-scan/issues/:issueId", (req: Request, res: Response) => {
    const { state } = req.body as { state: IssueState };
    if (!["active", "hidden", "fixed"].includes(state))
      return res.status(400).json({ ok: false, error: "Invalid state" });
    const ok = issueStore.setIssueState(Number(req.params.deploymentId), req.params.issueId, state);
    res.json({ ok, counts: issueStore.getIssueCounts(Number(req.params.deploymentId)) });
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  router.get("/deployments/:projectId/settings", async (req: Request, res: Response) => {
    try {
      res.json({ ok: true, settings: await settingsStore.getSettings(Number(req.params.projectId)) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put("/deployments/:projectId/settings", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      res.json({ ok: true, settings: await settingsStore.upsertSettings({ ...req.body, projectId }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Secrets ────────────────────────────────────────────────────────────────
  router.get("/deployments/:projectId/secrets", async (req: Request, res: Response) => {
    try {
      res.json({ ok: true, secrets: await settingsStore.listSecrets(Number(req.params.projectId)) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post("/deployments/:projectId/secrets", async (req: Request, res: Response) => {
    try {
      const { key, value } = req.body as { key: string; value: string };
      if (!key || !value) return res.status(400).json({ ok: false, error: "key and value are required" });
      res.json({ ok: true, secret: await settingsStore.addSecret(Number(req.params.projectId), key, value) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put("/deployments/:projectId/secrets/:secretId", async (req: Request, res: Response) => {
    try {
      const { value } = req.body as { value: string };
      if (!value) return res.status(400).json({ ok: false, error: "value is required" });
      const ok = await settingsStore.updateSecret(Number(req.params.projectId), Number(req.params.secretId), value);
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete("/deployments/:projectId/secrets/:secretId", async (req: Request, res: Response) => {
    try {
      const ok = await settingsStore.deleteSecret(Number(req.params.projectId), Number(req.params.secretId));
      res.json({ ok });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ── Auth config ────────────────────────────────────────────────────────────
  router.get("/deployments/:projectId/auth", async (req: Request, res: Response) => {
    try {
      res.json({ ok: true, config: await authConfigStore.getConfig(Number(req.params.projectId)) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put("/deployments/:projectId/auth", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      res.json({ ok: true, config: await authConfigStore.upsertConfig({ ...req.body, projectId }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.patch("/deployments/:projectId/auth/providers/:providerId", async (req: Request, res: Response) => {
    try {
      const projectId  = Number(req.params.projectId);
      const providerId = req.params.providerId as AuthProvider;
      const { enabled } = req.body as { enabled: boolean };
      res.json({ ok: true, config: await authConfigStore.toggleProvider(projectId, providerId, enabled) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
}
