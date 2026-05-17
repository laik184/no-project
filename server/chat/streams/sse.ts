/**
 * sse.ts — SSE endpoint router
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  PRIMARY ENDPOINT (use this for all new frontend connections):   │
 * │                                                                  │
 * │  GET /api/realtime                                               │
 * │                                                                  │
 * │  Unified, topic-multiplexed SSE stream. Replaces the 11 fragmented│
 * │  endpoints that caused duplicate connections and memory leaks.   │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Legacy endpoints below are kept only as fallbacks for any tooling
 * that hasn't been migrated.  Do not add new consumers against them.
 *
 * Pattern enforced by every endpoint:
 *   1. setupSse(res)          — headers, flush, send ": connected"
 *   2. bus.subscribe(...)     — one subscription per event type
 *   3. sseSend(res, name, e)  — ONE write per event (no duplicates)
 *   4. onClose(req, ...)      — single cleanup on connection close
 *
 * NEVER call res.write() directly — always use sseSend().
 * NEVER subscribe to the same bus event twice in one endpoint.
 */

import { Router, type Request, type Response } from "express";
import { bus } from "../../infrastructure/events/bus.ts";
import { setupSse, sseSend, startHeartbeat, onClose } from "./sse-utils.ts";
import { ALL_TOPICS, TOPIC } from "../../infrastructure/realtime/stream-topics.ts";

export function createSseRouter(): Router {
  const r = Router();

  // ══════════════════════════════════════════════════════════════════════════
  // PRIMARY: Unified topic-multiplexed SSE endpoint
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Query params:
  //   topics    comma-separated topic list (default: all)
  //             valid values: agent, lifecycle, console, file,
  //                           runtime.verified, runtime.observation,
  //                           diff, checkpoint
  //   projectId numeric project filter (optional — omit to receive all)
  //   runId     string run filter for agent/lifecycle/checkpoint (optional)
  //
  // Each event is sent with `event: <topic>` matching the topic string.
  //
  r.get("/api/realtime", (req: Request, res: Response) => {
    setupSse(res);

    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const runId     = req.query.runId as string | undefined;

    const rawTopics = req.query.topics as string | undefined;
    const requested = new Set<string>(
      rawTopics ? rawTopics.split(",").map((t) => t.trim()) : ALL_TOPICS,
    );

    const cleanups: Array<() => void> = [];

    // ── agent.event ───────────────────────────────────────────────────────
    if (requested.has(TOPIC.AGENT)) {
      cleanups.push(bus.subscribe("agent.event", (e) => {
        if (runId     && e.runId                !== runId)      return;
        if (projectId !== null && e.projectId   !== undefined
                               && e.projectId   !== projectId)  return;
        sseSend(res, TOPIC.AGENT, e);
      }));
    }

    // ── run.lifecycle ─────────────────────────────────────────────────────
    if (requested.has(TOPIC.LIFECYCLE)) {
      cleanups.push(bus.subscribe("run.lifecycle", (e) => {
        if (runId     && e.runId      !== runId)      return;
        if (projectId !== null && e.projectId !== projectId) return;
        sseSend(res, TOPIC.LIFECYCLE, e);
      }));
    }

    // ── console.log ───────────────────────────────────────────────────────
    if (requested.has(TOPIC.CONSOLE)) {
      cleanups.push(bus.subscribe("console.log", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        sseSend(res, TOPIC.CONSOLE, e);
      }));
    }

    // ── file.change ───────────────────────────────────────────────────────
    if (requested.has(TOPIC.FILE)) {
      cleanups.push(bus.subscribe("file.change", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        sseSend(res, TOPIC.FILE, e);
      }));
    }

    // ── runtime.verified ─────────────────────────────────────────────────
    if (requested.has(TOPIC.RUNTIME_VERIFIED)) {
      cleanups.push(bus.subscribe("runtime.verified", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        sseSend(res, TOPIC.RUNTIME_VERIFIED, e);
      }));
    }

    // ── runtime.observation ──────────────────────────────────────────────
    if (requested.has(TOPIC.RUNTIME_OBSERVATION)) {
      cleanups.push(bus.subscribe("runtime.observation", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        sseSend(res, TOPIC.RUNTIME_OBSERVATION, e);
      }));
    }

    // ── agent.diff ────────────────────────────────────────────────────────
    if (requested.has(TOPIC.DIFF)) {
      cleanups.push(bus.subscribe("agent.diff", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        sseSend(res, TOPIC.DIFF, e);
      }));
    }

    // ── checkpoint.event ─────────────────────────────────────────────────
    if (requested.has(TOPIC.CHECKPOINT)) {
      cleanups.push(bus.subscribe("checkpoint.event", (e) => {
        if (runId && e.runId && e.runId !== runId) return;
        if (projectId !== null && e.projectId !== projectId) return;
        sseSend(res, TOPIC.CHECKPOINT, e);
      }));
    }

    onClose(req, startHeartbeat(res), ...cleanups);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY ENDPOINTS — kept as fallbacks; do not add new consumers
  // ══════════════════════════════════════════════════════════════════════════

  // ── /api/agent/stream — run-scoped agent + lifecycle + checkpoint ─────
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
    const off3 = bus.subscribe("checkpoint.event", (e) => {
      if (runIdFilter && e.runId && e.runId !== runIdFilter) return;
      sseSend(res, "checkpoint", e);
    });
    onClose(req, startHeartbeat(res), off1, off2, off3);
  });

  // ── /sse/console — project-scoped console.log ─────────────────────────
  r.get("/sse/console", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off = bus.subscribe("console.log", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "console", e);
    });
    onClose(req, startHeartbeat(res), off);
  });

  // ── /sse/files — project-scoped file.change ───────────────────────────
  r.get("/sse/files", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off = bus.subscribe("file.change", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "file", e);
    });
    onClose(req, startHeartbeat(res), off);
  });

  // ── /sse/preview — console + lifecycle + runtime (project-scoped) ─────
  r.get("/sse/preview", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off1 = bus.subscribe("console.log", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "preview", e);
    });
    const off2 = bus.subscribe("run.lifecycle",       (e) => sseSend(res, "preview", e));
    const off3 = bus.subscribe("runtime.verified",    (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "runtime.verified", e);
    });
    const off4 = bus.subscribe("runtime.observation", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "runtime.observation", e);
    });
    onClose(req, startHeartbeat(res), off1, off2, off3, off4);
  });

  // ── /sse/diffs — project-scoped agent.diff ────────────────────────────
  r.get("/sse/diffs", (req: Request, res: Response) => {
    setupSse(res);
    const projectIdFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const off = bus.subscribe("agent.diff", (e) => {
      if (projectIdFilter !== null && e.projectId !== projectIdFilter) return;
      sseSend(res, "diff", e);
    });
    onClose(req, startHeartbeat(res), off);
  });

  return r;
}
