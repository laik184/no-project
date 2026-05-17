/**
 * sse.ts — Central SSE endpoint router
 *
 * All endpoints follow the same pattern:
 *   1. setupSse(res)          — set headers, flush, send ": connected"
 *   2. bus.subscribe(...)     — one subscription per event type
 *   3. sseSend(res, name, e)  — ONE write per event (no duplicates)
 *   4. onClose(req, ...)      — single cleanup on connection close
 *
 * NEVER call res.write() directly in a handler — always use sseSend().
 * NEVER subscribe to the same bus event twice in one endpoint.
 */

import { Router, type Request, type Response } from "express";
import { bus } from "../../infrastructure/events/bus.ts";
import { setupSse, sseSend, startHeartbeat, onClose } from "./sse-utils.ts";

export function createSseRouter(): Router {
  const r = Router();

  // ── Primary agent stream (runId-scoped) ─────────────────────────────────────
  // Used by: useAgentRunner (main chat hook)
  r.get("/api/agent/stream", (req: Request, res: Response) => {
    setupSse(res);
    const runIdFilter = req.query.runId as string | undefined;
    const off1 = bus.subscribe("agent.event", (e) => {
      if (runIdFilter && e.runId !== runIdFilter) return;
      sseSend(res, "agent", e);
    });
    const off2 = bus.subscribe("run.lifecycle", (e) => {
      if (runIdFilter && e.runId !== runIdFilter) return;
      sseSend(res, "lifecycle", e);
    });
    // Forward checkpoint lifecycle events (creating, stable, rollback, etc.)
    const off3 = bus.subscribe("checkpoint.event", (e) => {
      if (runIdFilter && e.runId && e.runId !== runIdFilter) return;
      sseSend(res, "checkpoint", e);
    });
    onClose(req, startHeartbeat(res), off1, off2, off3);
  });

  // ── Console log stream (projectId-scoped) ───────────────────────────────────
  // Used by: app-state-context (AppStateProvider), console panel
  r.get("/sse/console", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off = bus.subscribe("console.log", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "console", e);
    });
    onClose(req, startHeartbeat(res), off);
  });

  // ── File change stream (projectId-scoped) ────────────────────────────────────
  // Used by: use-file-explorer (file tree refresh)
  r.get("/sse/files", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off = bus.subscribe("file.change", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "file", e);
    });
    onClose(req, startHeartbeat(res), off);
  });

  // ── Solopilot console stream ─────────────────────────────────────────────────
  // Used by: SolopilotArchitectureModal
  r.get("/api/solopilot/stream", (req: Request, res: Response) => {
    setupSse(res);
    const off = bus.subscribe("console.log", (e) => sseSend(res, "solopilot", e));
    onClose(req, startHeartbeat(res), off);
  });

  // ── AGI catch-all stream (agent + lifecycle + console) ───────────────────────
  // Used by: useAgiStream (analytics dashboard)
  // Sends all three event types under the "agi" event name.
  r.get("/api/stream", (req: Request, res: Response) => {
    setupSse(res);
    const off1 = bus.subscribe("agent.event",  (e) => sseSend(res, "agi", e));
    const off2 = bus.subscribe("run.lifecycle", (e) => sseSend(res, "agi", e));
    const off3 = bus.subscribe("console.log",  (e) => sseSend(res, "agi", e));
    onClose(req, startHeartbeat(res), off1, off2, off3);
  });

  // ── Legacy /sse/agent stream (runId-scoped) ───────────────────────────────────
  // Used by: useAgentUltraStream
  // Mirrors /api/agent/stream for backward compatibility.
  // FIXED: removed duplicate res.write() that was causing double-emit.
  r.get("/sse/agent", (req: Request, res: Response) => {
    setupSse(res);
    const runIdFilter = req.query.runId as string | undefined;
    const off = bus.subscribe("agent.event", (e) => {
      if (runIdFilter && e.runId !== runIdFilter) return;
      sseSend(res, "agent", e); // ONE write only — no res.write() after this
    });
    onClose(req, startHeartbeat(res), off);
  });

  // ── Preview panel stream (console + lifecycle + runtime health) ──────────────
  // Used by: PreviewView, DevToolsPanel
  r.get("/sse/preview", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off1 = bus.subscribe("console.log",  (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "preview", e);
    });
    const off2 = bus.subscribe("run.lifecycle", (e) => sseSend(res, "preview", e));
    const off3 = bus.subscribe("runtime.verified", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "runtime.verified", e);
    });
    const off4 = bus.subscribe("runtime.observation", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "runtime.observation", e);
    });
    onClose(req, startHeartbeat(res), off1, off2, off3, off4);
  });

  // ── Runtime health stream (verified + observation, projectId-scoped) ─────────
  // Used by: Preview panel health indicator, agent dashboard
  r.get("/sse/runtime", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off1 = bus.subscribe("runtime.verified", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "runtime.verified", e);
    });
    const off2 = bus.subscribe("runtime.observation", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "runtime.observation", e);
    });
    onClose(req, startHeartbeat(res), off1, off2);
  });

  // ── Global event firehose (all bus events including runtime observation) ──────
  // Used by: connectSSE() in client/src/sse.ts (Dashboard, etc.)
  // Each event type sent under the single "event" name.
  r.get("/events", (req: Request, res: Response) => {
    setupSse(res);
    const off1 = bus.subscribe("agent.event",         (e) => sseSend(res, "event", e));
    const off2 = bus.subscribe("console.log",         (e) => sseSend(res, "event", e));
    const off3 = bus.subscribe("file.change",         (e) => sseSend(res, "event", e));
    const off4 = bus.subscribe("run.lifecycle",       (e) => sseSend(res, "event", e));
    const off5 = bus.subscribe("runtime.verified",    (e) => sseSend(res, "event", e));
    const off6 = bus.subscribe("runtime.observation", (e) => sseSend(res, "event", e));
    onClose(req, startHeartbeat(res), off1, off2, off3, off4, off5, off6);
  });

  // ── Diff approval stream (projectId-scoped) ──────────────────────────────────
  // Used by: useDiffApproval (diff modal in workspace)
  // Sends "diff" events when the agent wants to overwrite a file.
  r.get("/sse/diffs", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off = bus.subscribe("agent.diff", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "diff", e);
    });
    onClose(req, startHeartbeat(res), off);
  });

  // ── Solopilot dashboard stream (agent + lifecycle) ────────────────────────────
  r.get("/api/solopilot/dashboard/stream", (req: Request, res: Response) => {
    setupSse(res);
    const off1 = bus.subscribe("agent.event",  (e) => sseSend(res, "dashboard", e));
    const off2 = bus.subscribe("run.lifecycle", (e) => sseSend(res, "dashboard", e));
    onClose(req, startHeartbeat(res), off1, off2);
  });

  // ── Build log stream (console.log scoped by buildId) ─────────────────────────
  r.get("/api/builds/:buildId/logs", (req: Request, res: Response) => {
    setupSse(res);
    const buildId = req.params.buildId;
    const off = bus.subscribe("console.log", (e) => sseSend(res, "log", { buildId, ...e }));
    onClose(req, startHeartbeat(res), off);
  });

  // NOTE: /sse/file (singular) has been removed — it was a zombie duplicate of
  // /sse/files. Any client using /sse/file should switch to /sse/files.

  return r;
}
