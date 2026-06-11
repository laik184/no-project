/**
 * runtime-routes.ts — /api/runtime/:projectId/* routes
 *
 * Called by the frontend preview panel Run / Restart buttons.
 * Auto-detects the sandbox start command from the project record so the
 * frontend does not need to know (or send) a command string.
 */

import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import httpProxy from "http-proxy";
import type { RuntimeEntry } from "../../infrastructure/runtime/runtime-types.ts";

import { db } from "../../infrastructure/index.ts";
import { projects } from "../../../shared/schema.ts";
import { eq } from "drizzle-orm";
import { lifecycleManager } from "../lifecycle/preview-lifecycle-manager.ts";
import { previewRuntimeManager } from "../runtime/preview-runtime-manager.ts";
import { runtimeManager } from "../../infrastructure/index.ts";
import { packageManagerDetector } from "../../services/terminal/index.ts";

// ── Shared proxy server (created once) ────────────────────────────────────────
const sandboxProxy = httpProxy.createProxyServer({ selfHandleResponse: false });

// ── Idle HTML (shown in iframe when no project is running) ────────────────────

const IDLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Preview</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d0d0f;
    color: #9ca3af;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    display: flex; align-items: center; justify-content: center;
    height: 100vh; text-align: center;
  }
</style>
</head>
<body></body>
</html>`;

// ── Port detection from process stdout ────────────────────────────────────────

const PORT_PATTERNS = [
  /listening on .*?:(\d{4,5})/i,
  /Local:\s+http:\/\/localhost:(\d{4,5})/i,
  /running on.*?:(\d{4,5})/i,
  /started.*?port[: ]+(\d{4,5})/i,
  /port[: ]+(\d{4,5})/i,
  /:(\d{4,5})\s*\n/,
];

function detectPortFromLogs(logs: string[]): number | undefined {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i];
    for (const re of PORT_PATTERNS) {
      const m = line.match(re);
      if (m) {
        const p = parseInt(m[1], 10);
        if (p > 1024 && p < 65536) return p;
      }
    }
  }
  return undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve a start command for the sandbox.
 * Priority:
 *   1. package.json → scripts.dev
 *   2. package.json → scripts.start
 *   3. index.js / server.js / main.js present → "node <file>"
 *   4. Fallback: "npm run dev"
 */
/** Returns null when the sandbox has no runnable content. */
function packageManagerRunCommand(sandboxPath: string, script: string): string {
  const { manager } = packageManagerDetector.detect(sandboxPath);
  switch (manager) {
    case "yarn":
      return `yarn ${script}`;
    case "pnpm":
      return `pnpm run ${script}`;
    case "bun":
      return `bun run ${script}`;
    default:
      return `npm run ${script}`;
  }
}

function detectCommand(
  sandboxPath: string,
): { command: string; port?: number } | null {
  const abs = resolve(sandboxPath);

  if (!existsSync(abs)) return null;

  const pkgPath = resolve(abs, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const scripts: Record<string, string> = pkg.scripts ?? {};
      if (scripts.dev)
        return {
          command: packageManagerRunCommand(abs, "dev"),
          port: undefined,
        };
      if (scripts.start)
        return {
          command: packageManagerRunCommand(abs, "start"),
          port: undefined,
        };
    } catch {
      /* ignore parse errors */
    }
  }

  for (const entry of ["index.js", "server.js", "main.js", "app.js"]) {
    if (existsSync(resolve(abs, entry))) {
      return { command: `node ${entry}` };
    }
  }

  // Sandbox exists but has no known entry point → nothing to run
  return null;
}

async function fetchProject(projectId: number) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project ?? null;
}


function parseProjectId(req: Request): number | null {
  const raw = req.query.projectId ?? req.params.projectId;
  if (raw == null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const projectId = Number(value);
  return Number.isFinite(projectId) && projectId > 0 ? projectId : null;
}

function isProxyableRuntime(entry: RuntimeEntry | undefined): entry is RuntimeEntry {
  return Boolean(
    entry &&
    (entry.status === "running" || entry.status === "starting") &&
    (entry.port ?? detectPortFromLogs(entry.logs as string[])),
  );
}

function selectRuntimeEntry(projectId: number | null): RuntimeEntry | undefined {
  if (projectId != null) {
    const requested = runtimeManager.get(projectId);
    return isProxyableRuntime(requested) ? requested : undefined;
  }

  return runtimeManager
    .all()
    .find((entry) => isProxyableRuntime(entry));
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleStart(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId)) {
    res.status(400).json({ ok: false, error: "Invalid projectId." });
    return;
  }

  const project = await fetchProject(projectId);
  if (!project) {
    res
      .status(404)
      .json({ ok: false, error: `Project ${projectId} not found.` });
    return;
  }

  const sandboxPath =
    project.sandboxPath ?? process.env.AGENT_PROJECT_ROOT ?? ".sandbox";
  const detected = detectCommand(sandboxPath);

  if (!detected) {
    // Nothing to run yet — transition lifecycle to reflect that and tell the client.
    await lifecycleManager.markCrashed(projectId, null).catch(() => {});
    res.json({
      ok: false,
      empty: true,
      error:
        "No app built yet — describe your idea in the chat to get started.",
    });
    return;
  }

  const { command, port } = detected;
  const result = await previewRuntimeManager.start(projectId, {
    command,
    port,
    cwd: resolve(sandboxPath),
    env: { PROJECT_ROOT: resolve(sandboxPath) },
  });

  res.json({ ok: result.ok, error: result.error, command, sandboxPath });
}

async function handleRestart(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId)) {
    res.status(400).json({ ok: false, error: "Invalid projectId." });
    return;
  }

  const project = await fetchProject(projectId);
  if (!project) {
    res
      .status(404)
      .json({ ok: false, error: `Project ${projectId} not found.` });
    return;
  }

  const sandboxPath =
    project.sandboxPath ?? process.env.AGENT_PROJECT_ROOT ?? ".sandbox";
  const detected = detectCommand(sandboxPath);

  if (!detected) {
    await lifecycleManager.markCrashed(projectId, null).catch(() => {});
    res.json({ ok: false, empty: true, error: "No app built yet." });
    return;
  }

  const { command, port } = detected;
  const result = await previewRuntimeManager.restart(projectId, {
    command,
    port,
    cwd: resolve(sandboxPath),
    env: { PROJECT_ROOT: resolve(sandboxPath) },
  });

  res.json({ ok: result.ok, error: result.error });
}

async function handleStop(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId)) {
    res.status(400).json({ ok: false, error: "Invalid projectId." });
    return;
  }

  await previewRuntimeManager.stop(projectId);
  res.json({ ok: true });
}

/**
 * Legacy /api/restart — restarts project 1 (the default seeded project).
 * Used by the no-projectId fallback in useNavigationLogic.
 */
async function handleLegacyRestart(
  _req: Request,
  res: Response,
): Promise<void> {
  const DEFAULT_PROJECT_ID = 1;
  try {
    const project = await fetchProject(DEFAULT_PROJECT_ID);
    const sandboxPath =
      project?.sandboxPath ?? process.env.AGENT_PROJECT_ROOT ?? ".sandbox";
    const detected = detectCommand(sandboxPath);
    if (!detected) {
      res.json({ ok: false, empty: true });
      return;
    }
    const { command, port } = detected;
    await previewRuntimeManager.restart(DEFAULT_PROJECT_ID, {
      command,
      port,
      cwd: resolve(sandboxPath),
    });
    res.json({ ok: true });
  } catch (err) {
    await lifecycleManager.markCrashed(DEFAULT_PROJECT_ID, null).catch(() => {});
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Preview frame proxy ───────────────────────────────────────────────────────
// Mounted at /preview/frame (already proxied by Vite's /preview → :3001 rule).
// When a sandbox project is running, proxies through to its port.
// When nothing is running, serves a minimal dark HTML page.

export function buildPreviewFrameHandler() {
  sandboxProxy.on("error", (_err, _req, proxyRes) => {
    try {
      const r = proxyRes as Response;
      if (!r.headersSent) {
        r.setHeader("Content-Type", "text/html; charset=utf-8");
        r.end(IDLE_HTML);
      }
    } catch {
      /* swallow */
    }
  });

  return (_req: Request, res: Response, _next: NextFunction) => {
    const projectId = parseProjectId(_req);
    const entry = selectRuntimeEntry(projectId);

    if (!entry) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(IDLE_HTML);
      return;
    }

    const port = entry.port ?? detectPortFromLogs(entry.logs as string[]);
    if (!port) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(IDLE_HTML);
      return;
    }

    sandboxProxy.web(_req, res, {
      target: `http://127.0.0.1:${port}`,
      changeOrigin: true,
    });
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export function buildRuntimeRouter(): Router {
  const router = Router();

  router.post("/:projectId/start", handleStart);
  router.post("/:projectId/restart", handleRestart);
  router.post("/:projectId/stop", handleStop);

  return router;
}

export { handleLegacyRestart };
