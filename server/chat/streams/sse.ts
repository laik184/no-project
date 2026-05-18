/**
 * sse.ts — Unified SSE gateway (single endpoint, C4-clean, C6-recoverable)
 *
 * GET /api/realtime
 *   Topic-multiplexed SSE stream.  All frontend realtime connections
 *   use this endpoint via RealtimeProvider (client/src/realtime/).
 *
 *   Query params:
 *     topics       comma-separated subset (default: all topics)
 *     projectId    numeric project filter
 *     runId        string run filter (agent / lifecycle / checkpoint)
 *     lastEventId  last sequence ID received by client — triggers replay
 *                  of all missed events before the live subscription starts
 *
 * C6 recovery: every outgoing event gets an `id: <seqId>` SSE field.
 *   The browser EventSource tracks the last id automatically.
 *   RealtimeProvider passes it as ?lastEventId=N on reconnect.
 *   On connect the server replays all cached events with seqId > lastEventId
 *   before attaching live bus subscriptions, eliminating missed-event gaps.
 *
 * Rules (C4 duplicate-event contract, preserved):
 *   1. setupSse(res)         — headers + ": connected" heartbeat
 *   2. bus.subscribe(...)    — EXACTLY ONE subscription per topic per conn
 *   3. sseSendId(res, ...)   — single write per event, carries id: field
 *   4. onClose(req, ...)     — all subscriptions cleaned on disconnect
 *
 * NEVER call res.write() directly — always use sseSendId() or sseSend().
 * NEVER subscribe to the same bus event twice in one handler.
 * DO NOT add legacy endpoints — use /api/realtime with topic filtering.
 */

import { Router, type Request, type Response } from "express";
import { bus } from "../../infrastructure/events/bus.ts";
import { setupSse, sseSendId, startHeartbeat, onClose } from "./sse-utils.ts";
import { ALL_TOPICS, TOPIC } from "../../infrastructure/realtime/stream-topics.ts";
import { record, replay } from "../../realtime/replay-cache.ts";

export function createSseRouter(): Router {
  const r = Router();

  // ══════════════════════════════════════════════════════════════════════════
  // PRIMARY: Unified topic-multiplexed SSE endpoint
  // ══════════════════════════════════════════════════════════════════════════
  r.get("/api/realtime", (req: Request, res: Response) => {
    setupSse(res);

    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const runId     = req.query.runId as string | undefined;

    const rawTopics = req.query.topics as string | undefined;
    const requested = new Set<string>(
      rawTopics ? rawTopics.split(",").map((t) => t.trim()) : ALL_TOPICS,
    );

    // ── C6: Replay missed events on reconnect ────────────────────────────────
    // lastEventId is sent by RealtimeProvider as ?lastEventId=N on every
    // reconnect attempt (browser EventSource tracks the last `id:` it received).
    const rawLastId = (req.headers["last-event-id"] as string | undefined)
                   ?? (req.query.lastEventId as string | undefined);
    if (rawLastId) {
      const lastSeqId = Number(rawLastId);
      if (Number.isFinite(lastSeqId) && lastSeqId > 0) {
        const missed = replay(lastSeqId, requested);
        for (const evt of missed) {
          sseSendId(res, evt.topic, evt.data, evt.seqId);
        }
      }
    }

    const cleanups: Array<() => void> = [];

    // Helper: record to replay cache + send with id field
    const emit = (topic: string, data: unknown) => {
      const seqId = record(topic, data);
      sseSendId(res, topic, data, seqId);
    };

    // ── agent.event ───────────────────────────────────────────────────────
    if (requested.has(TOPIC.AGENT)) {
      cleanups.push(bus.subscribe("agent.event", (e) => {
        if (runId     && e.runId                !== runId)      return;
        if (projectId !== null && e.projectId   !== undefined
                               && e.projectId   !== projectId)  return;
        emit(TOPIC.AGENT, e);
      }));
    }

    // ── run.lifecycle ─────────────────────────────────────────────────────
    if (requested.has(TOPIC.LIFECYCLE)) {
      cleanups.push(bus.subscribe("run.lifecycle", (e) => {
        if (runId     && e.runId      !== runId)      return;
        if (projectId !== null && e.projectId !== projectId) return;
        emit(TOPIC.LIFECYCLE, e);
      }));
    }

    // ── console.log ───────────────────────────────────────────────────────
    if (requested.has(TOPIC.CONSOLE)) {
      cleanups.push(bus.subscribe("console.log", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        emit(TOPIC.CONSOLE, e);
      }));
    }

    // ── file.change ───────────────────────────────────────────────────────
    if (requested.has(TOPIC.FILE)) {
      cleanups.push(bus.subscribe("file.change", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        emit(TOPIC.FILE, e);
      }));
    }

    // ── runtime.verified ─────────────────────────────────────────────────
    if (requested.has(TOPIC.RUNTIME_VERIFIED)) {
      cleanups.push(bus.subscribe("runtime.verified", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        emit(TOPIC.RUNTIME_VERIFIED, e);
      }));
    }

    // ── runtime.observation ──────────────────────────────────────────────
    if (requested.has(TOPIC.RUNTIME_OBSERVATION)) {
      cleanups.push(bus.subscribe("runtime.observation", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        emit(TOPIC.RUNTIME_OBSERVATION, e);
      }));
    }

    // ── agent.diff ────────────────────────────────────────────────────────
    if (requested.has(TOPIC.DIFF)) {
      cleanups.push(bus.subscribe("agent.diff", (e) => {
        if (projectId !== null && e.projectId !== projectId) return;
        emit(TOPIC.DIFF, e);
      }));
    }

    // ── checkpoint.event ─────────────────────────────────────────────────
    if (requested.has(TOPIC.CHECKPOINT)) {
      cleanups.push(bus.subscribe("checkpoint.event", (e) => {
        if (runId && e.runId && e.runId !== runId) return;
        if (projectId !== null && e.projectId !== projectId) return;
        emit(TOPIC.CHECKPOINT, e);
      }));
    }

    onClose(req, startHeartbeat(res), ...cleanups);
  });

  return r;
}
