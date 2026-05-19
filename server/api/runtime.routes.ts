/**
 * runtime.routes.ts
 *
 * HTTP API for managing project runtimes.
 *
 * ALL process state is owned by runtimeManager — the single entry point
 * for runtime operations. No local Maps, no spawn calls, no sandbox path
 * resolution here.
 */

import { Router, type Request, type Response } from "express";
import { spawn } from "child_process";
import { getProjectDir } from "../infrastructure/sandbox/sandbox.util.ts";
import { runtimeManager } from "../infrastructure/runtime/runtime-manager.ts";
import { getLifecycleManager } from "../preview/lifecycle/preview-lifecycle.manager.ts";
import { db } from "../infrastructure/db/index.ts";
import { projects } from "../../shared/schema.ts";
import { eq } from "drizzle-orm";

export function createRuntimeRouter(): Router {
  const router = Router();

  // ── Start ──────────────────────────────────────────────────────────────
  router.post("/api/runtime/:projectId/start", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const mgr = getLifecycleManager(projectId);
      mgr.forceTransition("starting", "Starting project server…");

      const result = await runtimeManager.start(projectId);
      if (!result.ok) {
        mgr.forceTransition("crashed", result.error ?? "Failed to start.", { error: result.error });
        return res.status(500).json({ ok: false, error: result.error });
      }

      if (!result.alreadyRunning) {
        mgr.forceTransition("ready", `Server ready on port ${result.port}.`, { port: result.port });
        await db
          .update(projects)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(projects.id, projectId))
          .catch(() => {});
      } else {
        mgr.forceTransition("ready", "Server already running.", { port: result.port });
      }

      res.json({ ok: true, already_running: result.alreadyRunning ?? false, port: result.port, pid: result.pid, projectId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Stop ───────────────────────────────────────────────────────────────
  router.post("/api/runtime/:projectId/stop", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const mgr = getLifecycleManager(projectId);

      if (!runtimeManager.isRunning(projectId)) {
        mgr.forceTransition("idle", "Server not running.");
        return res.json({ ok: true, message: "No running server", projectId });
      }

      const result = runtimeManager.stop(projectId);
      if (!result.ok) return res.status(500).json({ ok: false, error: result.error });

      mgr.forceTransition("idle", "Project stopped.");
      await db
        .update(projects)
        .set({ status: "idle", updatedAt: new Date() })
        .where(eq(projects.id, projectId))
        .catch(() => {});

      res.json({ ok: true, stopped: true, projectId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Restart ────────────────────────────────────────────────────────────
  router.post("/api/runtime/:projectId/restart", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const mgr = getLifecycleManager(projectId);
      mgr.forceTransition("restarting", "Restarting project server…");

      const result = await runtimeManager.restart(projectId);
      if (!result.ok) {
        mgr.forceTransition("crashed", result.error ?? "Restart failed.", { error: result.error });
        return res.status(500).json({ ok: false, error: result.error });
      }

      mgr.forceTransition("ready", "Restart complete.", { port: result.port });
      res.json({ ok: true, restarted: true, port: result.port, pid: result.pid, projectId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Lifecycle state — single project ───────────────────────────────────
  // GET /api/lifecycle-state/:projectId — current lifecycle snapshot.
  router.get("/api/lifecycle-state/:projectId", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const mgr   = getLifecycleManager(projectId);
    const state = mgr.getState();
    const isRunning = runtimeManager.isRunning(projectId);
    const entry = runtimeManager.get(projectId);

    // Reconcile: if manager says idle but process is running, sync to ready.
    if (state === "idle" && isRunning) {
      mgr.forceTransition("ready", `Server running on port ${entry?.port ?? "?"}.`, { port: entry?.port });
    }

    res.json({ ok: true, projectId, state: mgr.getState(), running: isRunning, port: entry?.port ?? null });
  });

  // ── Lifecycle state — all projects ─────────────────────────────────────
  router.get("/api/lifecycle-state", (_req: Request, res: Response) => {
    const all = runtimeManager.all();
    const entries = all.map(e => {
      const mgr   = getLifecycleManager(e.projectId);
      const state = mgr.getState();
      if (state === "idle" && e.status === "running") {
        mgr.forceTransition("ready", `Server running on port ${e.port ?? "?"}.`, { port: e.port });
      }
      return { projectId: e.projectId, state: mgr.getState(), port: e.port, status: e.status };
    });
    res.json({ ok: true, entries, count: entries.length });
  });

  // ── Logs ───────────────────────────────────────────────────────────────
  router.get("/api/runtime/:projectId/logs", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const tail = Number(req.query.tail) || 50;
    const entry = runtimeManager.get(projectId);

    if (!entry) return res.json({ ok: true, running: false, logs: [] });

    res.json({
      ok: true,
      running: runtimeManager.isRunning(projectId),
      port: entry.port,
      logs: runtimeManager.getLogs(projectId, tail),
    });
  });

  // ── Status ─────────────────────────────────────────────────────────────
  router.get("/api/runtime/:projectId/status", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const entry = runtimeManager.get(projectId);

    res.json({
      ok: true,
      projectId,
      running: runtimeManager.isRunning(projectId),
      status: entry?.status ?? "stopped",
      port: entry?.port ?? null,
      pid: entry?.pid ?? null,
      uptimeMs: entry?.uptimeMs ?? null,
    });
  });

  // ── Package install ────────────────────────────────────────────────────
  router.post("/api/runtime/:projectId/packages/install", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const { packages, dev } = req.body;
      const cwd = getProjectDir(projectId);
      const args = ["install", ...(dev ? ["--save-dev"] : []), ...(packages || [])];

      const result = await new Promise<{ ok: boolean; stdout: string; stderr: string }>(
        (resolve) => {
          let stdout = "";
          let stderr = "";
          const proc = spawn("npm", args, { cwd, shell: false });
          proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
          proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
          proc.on("close", (code) =>
            resolve({ ok: code === 0, stdout: stdout.slice(-5000), stderr: stderr.slice(-2000) })
          );
          proc.on("error", (e) =>
            resolve({ ok: false, stdout: "", stderr: e.message })
          );
        }
      );

      res.json({ ok: result.ok, ...result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Git actions ────────────────────────────────────────────────────────
  router.post("/api/runtime/:projectId/git/:action", async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const { action } = req.params;
      const cwd = getProjectDir(projectId);

      let gitArgs: string[] = [];
      if (action === "status") gitArgs = ["status", "--short"];
      else if (action === "add") gitArgs = ["add", ...(req.body.paths || ["."])];
      else if (action === "commit")
        gitArgs = [
          "-c", "user.email=agent@nura-x.dev",
          "-c", "user.name=NURA-X",
          "commit", "-m", req.body.message || "Auto commit",
        ];
      else return res.status(400).json({ ok: false, error: `Unknown git action: ${action}` });

      const result = await new Promise<{ ok: boolean; stdout: string; stderr: string }>(
        (resolve) => {
          let stdout = "";
          let stderr = "";
          const proc = spawn("git", gitArgs, { cwd, shell: false });
          proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
          proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
          proc.on("close", (code) => resolve({ ok: code === 0, stdout, stderr }));
          proc.on("error", (e) => resolve({ ok: false, stdout: "", stderr: e.message }));
        }
      );

      res.json({ ok: result.ok, action, ...result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Screenshot / preview URL ───────────────────────────────────────────
  router.get("/api/runtime/:projectId/screenshot", (req: Request, res: Response) => {
    const projectId = Number(req.params.projectId);
    const port = runtimeManager.getPort(projectId);
    const url = runtimeManager.previewUrl(projectId, port);
    res.json({ ok: true, url, port: port ?? null, running: !!port });
  });

  return router;
}
