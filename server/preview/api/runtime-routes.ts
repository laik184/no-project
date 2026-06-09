/**
 * runtime-routes.ts — /api/runtime/:projectId/* routes
 *
 * Called by the frontend preview panel Run / Restart buttons.
 * Auto-detects the sandbox start command from the project record so the
 * frontend does not need to know (or send) a command string.
 */

import { Router, type Request, type Response } from "express";
import { existsSync, readFileSync }             from "fs";
import { resolve }                              from "path";

import { db }                     from "../../infrastructure/index.ts";
import { projects }               from "../../../shared/schema.ts";
import { eq }                     from "drizzle-orm";
import { lifecycleManager }       from "../lifecycle/preview-lifecycle-manager.ts";
import { previewRuntimeManager }  from "../runtime/preview-runtime-manager.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve a start command for the sandbox.
 * Priority:
 *   1. package.json → scripts.dev
 *   2. package.json → scripts.start
 *   3. index.js / server.js / main.js present → "node <file>"
 *   4. Fallback: "npm run dev"
 */
function detectCommand(sandboxPath: string): { command: string; port?: number } {
  const abs = resolve(sandboxPath);

  const pkgPath = resolve(abs, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const scripts: Record<string, string> = pkg.scripts ?? {};
      if (scripts.dev)   return { command: "npm run dev",   port: undefined };
      if (scripts.start) return { command: "npm run start", port: undefined };
    } catch { /* ignore parse errors */ }
  }

  for (const entry of ["index.js", "server.js", "main.js", "app.js"]) {
    if (existsSync(resolve(abs, entry))) {
      return { command: `node ${entry}` };
    }
  }

  return { command: "npm run dev" };
}

async function fetchProject(projectId: number) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project ?? null;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleStart(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId)) { res.status(400).json({ ok: false, error: "Invalid projectId." }); return; }

  const project = await fetchProject(projectId);
  if (!project) { res.status(404).json({ ok: false, error: `Project ${projectId} not found.` }); return; }

  const sandboxPath = project.sandboxPath ?? process.env.AGENT_PROJECT_ROOT ?? ".sandbox";
  const { command, port } = detectCommand(sandboxPath);

  const result = await previewRuntimeManager.start(projectId, {
    command,
    port,
    env: { PROJECT_ROOT: resolve(sandboxPath) },
  });

  res.json({ ok: result.ok, error: result.error, command, sandboxPath });
}

async function handleRestart(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId)) { res.status(400).json({ ok: false, error: "Invalid projectId." }); return; }

  const project = await fetchProject(projectId);
  if (!project) { res.status(404).json({ ok: false, error: `Project ${projectId} not found.` }); return; }

  const sandboxPath = project.sandboxPath ?? process.env.AGENT_PROJECT_ROOT ?? ".sandbox";
  const { command, port } = detectCommand(sandboxPath);

  const result = await previewRuntimeManager.restart(projectId, {
    command,
    port,
    env: { PROJECT_ROOT: resolve(sandboxPath) },
  });

  res.json({ ok: result.ok, error: result.error });
}

async function handleStop(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId)) { res.status(400).json({ ok: false, error: "Invalid projectId." }); return; }

  await previewRuntimeManager.stop(projectId);
  res.json({ ok: true });
}

/**
 * Legacy /api/restart — restarts project 1 (the default seeded project).
 * Used by the no-projectId fallback in useNavigationLogic.
 */
async function handleLegacyRestart(_req: Request, res: Response): Promise<void> {
  const DEFAULT_PROJECT_ID = 1;
  try {
    const project = await fetchProject(DEFAULT_PROJECT_ID);
    const sandboxPath = project?.sandboxPath ?? process.env.AGENT_PROJECT_ROOT ?? ".sandbox";
    const { command, port } = detectCommand(sandboxPath);
    await previewRuntimeManager.restart(DEFAULT_PROJECT_ID, { command, port });
    res.json({ ok: true });
  } catch (err) {
    await lifecycleManager.markStarting(DEFAULT_PROJECT_ID).catch(() => {});
    res.json({ ok: true, note: "lifecycle nudged" });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export function buildRuntimeRouter(): Router {
  const router = Router();

  router.post("/:projectId/start",   handleStart);
  router.post("/:projectId/restart", handleRestart);
  router.post("/:projectId/stop",    handleStop);

  return router;
}

export { handleLegacyRestart };
