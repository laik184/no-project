/**
 * preview-controller.ts — HTTP request handlers for the preview API.
 * Imports ONLY from services/preview/index.ts (via preview module boundary).
 */

import type { Request, Response } from "express";
import { previewService }         from "../../services/preview/index.ts";
import { lifecycleService }       from "../../services/preview/index.ts";
import { runtimeHealthService }   from "../../services/preview/index.ts";
import { devtoolsService }        from "../../services/preview/index.ts";
import { reloadService }          from "../../services/preview/index.ts";
import { lifecycleManager }       from "../lifecycle/preview-lifecycle-manager.ts";
import { previewRuntimeManager }  from "../runtime/preview-runtime-manager.ts";
import { consoleCapture }         from "../devtools/console-capture.ts";
import { networkCapture }         from "../devtools/network-capture.ts";
import { domInspector }           from "../devtools/dom-inspector.ts";
import type { ReloadType }        from "../../services/preview/index.ts";

// ── GET /api/preview/state ────────────────────────────────────────────────────

export async function getPreviewState(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.query.projectId ?? req.params.projectId);

  if (isNaN(projectId)) {
    // Return all states
    const allStates = await Promise.all(
      (await runtimeHealthService.getAll()).map(async (h) => {
        const state = await lifecycleService.getCurrentState(h.projectId);
        return {
          projectId:    h.projectId,
          state:        state.state,
          prevState:    state.prevState,
          message:      state.message,
          running:      h.healthy,
          port:         h.port,
          ts:           state.ts,
        };
      }),
    );
    res.json({ ok: true, entries: allStates });
    return;
  }

  const state  = await lifecycleService.getCurrentState(projectId);
  const health = await runtimeHealthService.getCached(projectId);

  res.json({
    ok:        true,
    projectId,
    state:     state.state,
    prevState: state.prevState,
    message:   state.message,
    running:   health?.healthy ?? false,
    port:      health?.port ?? null,
    ts:        state.ts,
  });
}

// ── GET /api/preview/health ───────────────────────────────────────────────────

export async function getPreviewHealth(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.query.projectId ?? req.params.projectId);

  if (isNaN(projectId)) {
    const all = await runtimeHealthService.getAll();
    res.json({ ok: true, entries: all });
    return;
  }

  const health = await runtimeHealthService.snapshot(projectId);
  res.json({ ok: true, health });
}

// ── GET /api/preview/session/:id ──────────────────────────────────────────────

export async function getPreviewSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const session = await previewService.getSession(id);

  if (!session) {
    res.status(404).json({ ok: false, error: `Session not found: ${id}` });
    return;
  }

  res.json({ ok: true, session });
}

// ── POST /api/preview/reload ──────────────────────────────────────────────────

export async function postPreviewReload(req: Request, res: Response): Promise<void> {
  const { projectId, type = "hard", reason = "Manual reload" } = req.body as {
    projectId: number;
    type?:     ReloadType;
    reason?:   string;
  };

  if (!projectId) {
    res.status(400).json({ ok: false, error: "projectId is required." });
    return;
  }

  reloadService.request(Number(projectId), type, reason);
  res.json({ ok: true, queued: true, projectId, type });
}

// ── POST /api/preview/start ───────────────────────────────────────────────────

export async function postPreviewStart(req: Request, res: Response): Promise<void> {
  const { projectId, command, port, env } = req.body as {
    projectId: number;
    command:   string;
    port?:     number;
    env?:      Record<string, string>;
  };

  if (!projectId || !command) {
    res.status(400).json({ ok: false, error: "projectId and command are required." });
    return;
  }

  const result = await previewRuntimeManager.start(Number(projectId), { command, port, env });
  res.json({ ok: result.ok, error: result.error });
}

// ── POST /api/preview/stop ────────────────────────────────────────────────────

export async function postPreviewStop(req: Request, res: Response): Promise<void> {
  const { projectId } = req.body as { projectId: number };
  if (!projectId) {
    res.status(400).json({ ok: false, error: "projectId is required." });
    return;
  }
  await previewRuntimeManager.stop(Number(projectId));
  res.json({ ok: true });
}

// ── POST /api/preview/lifecycle ───────────────────────────────────────────────

export async function postPreviewLifecycle(req: Request, res: Response): Promise<void> {
  const { projectId, state, message = "", meta = {} } = req.body as {
    projectId: number;
    state:     string;
    message?:  string;
    meta?:     Record<string, unknown>;
  };

  if (!projectId || !state) {
    res.status(400).json({ ok: false, error: "projectId and state are required." });
    return;
  }

  const result = await lifecycleManager.transition(
    Number(projectId), state as never, message, meta,
  );

  if (!result.ok) {
    res.status(422).json({ ok: false, error: result.error });
    return;
  }

  res.json({ ok: true });
}

// ── POST /api/preview/devtools/console ───────────────────────────────────────

export async function postDevtoolsConsole(req: Request, res: Response): Promise<void> {
  const { projectId, level = "log", args = [] } = req.body as {
    projectId: number;
    level?:    string;
    args?:     unknown[];
  };
  if (!projectId) { res.status(400).json({ ok: false, error: "projectId required." }); return; }
  consoleCapture.ingest({ projectId: Number(projectId), level, args });
  res.json({ ok: true });
}

// ── POST /api/preview/devtools/network ───────────────────────────────────────

export async function postDevtoolsNetwork(req: Request, res: Response): Promise<void> {
  const { projectId, method = "GET", url = "", status = null, type = "xhr" } = req.body as {
    projectId: number; method?: string; url?: string; status?: number | null; type?: string;
  };
  if (!projectId) { res.status(400).json({ ok: false, error: "projectId required." }); return; }
  networkCapture.ingest({ projectId: Number(projectId), method, url, status, type });
  res.json({ ok: true });
}

// ── GET /api/preview/devtools ─────────────────────────────────────────────────

export async function getDevtools(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.query.projectId);
  if (isNaN(projectId)) { res.status(400).json({ ok: false, error: "projectId required." }); return; }

  const snapshot  = devtoolsService.getSnapshot(projectId);
  const element   = domInspector.get(projectId);
  res.json({ ok: true, ...snapshot, selectedElement: element });
}

// ── GET /api/preview/metrics ──────────────────────────────────────────────────
// Used by useRuntimeHealth hook (polls every 5 s).
// Returns a "metrics" envelope that matches what the frontend expects.

export async function getPreviewMetrics(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.query.projectId ?? req.params.projectId);

  if (isNaN(projectId)) {
    // All projects
    const allHealth = await runtimeHealthService.getAll();
    const allStates = await Promise.all(
      allHealth.map(async (h) => {
        const state = await lifecycleService.getCurrentState(h.projectId);
        return {
          projectId:      h.projectId,
          pid:            h.pid,
          port:           h.port,
          status:         h.status,
          lifecycleState: state.state,
          uptimeMs:       h.uptime,
          uptimeFmt:      h.uptimeFmt,
          restartCount:   h.restartCount,
          healthy:        h.healthy,
          checkedAt:      h.checkedAt,
        };
      }),
    );
    res.json({ ok: true, metrics: allStates });
    return;
  }

  const health = await runtimeHealthService.snapshot(projectId);
  const state  = await lifecycleService.getCurrentState(projectId);

  res.json({
    ok: true,
    metrics: {
      projectId,
      pid:            health.pid,
      port:           health.port,
      status:         health.status,
      lifecycleState: state.state,
      uptimeMs:       health.uptime,
      uptimeFmt:      health.uptimeFmt,
      restartCount:   health.restartCount,
      healthy:        health.healthy,
      checkedAt:      health.checkedAt,
    },
  });
}

// ── GET /api/lifecycle-state ──────────────────────────────────────────────────
// Used by usePreviewLifecycle hook (initial state sync on mount).

export async function getLifecycleState(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.query.projectId ?? req.params.projectId);

  if (isNaN(projectId)) {
    // Return a list of all known states (frontend picks the first running one)
    const health = await runtimeHealthService.getAll();
    const entries = await Promise.all(
      health.map(async (h) => {
        const state = await lifecycleService.getCurrentState(h.projectId);
        return {
          projectId: h.projectId,
          state:     state.state,
          prevState: state.prevState,
          message:   state.message,
          running:   h.healthy,
          port:      h.port,
          ts:        state.ts,
        };
      }),
    );
    res.json({ ok: true, entries });
    return;
  }

  const state  = await lifecycleService.getCurrentState(projectId);
  const health = await runtimeHealthService.getCached(projectId);

  res.json({
    ok:        true,
    projectId,
    state:     state.state,
    prevState: state.prevState,
    message:   state.message,
    running:   health?.healthy ?? false,
    port:      health?.port ?? null,
    ts:        state.ts,
  });
}
