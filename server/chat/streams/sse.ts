/**
 * sse.ts — Unified SSE gateway (single endpoint, C4-clean)
 *
 * GET /api/realtime
 *   Topic-multiplexed SSE stream.  All frontend realtime connections
 *   use this endpoint via RealtimeProvider (client/src/realtime/).
 *
 *   Query params:
 *     topics    comma-separated subset (default: all topics)
 *     projectId numeric project filter
 *     runId     string run filter (agent / lifecycle / checkpoint)
 *
 * Rules enforced here (C4 duplicate-event contract):
 *   1. setupSse(res)          — headers + ": connected" heartbeat
 *   2. bus.subscribe(...)     — EXACTLY ONE subscription per topic per conn
 *   3. sseSend(res, name, e)  — single write per event, no duplicates
 *   4. onClose(req, ...)      — all subscriptions cleaned on disconnect
 *
 * NEVER call res.write() directly — always use sseSend().
 * NEVER subscribe to the same bus event twice in one handler.
 * DO NOT add legacy endpoints — use /api/realtime with topic filtering.
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

  return r;
}
