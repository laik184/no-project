/**
 * subscription-manager.ts — ONE bus listener per event type (hub pattern).
 *
 * BEFORE: Each SSE connection called bus.subscribe() for every topic it
 * wanted. With 1000 concurrent clients × 8 topics = 8000 listeners total,
 * far past Node.js MaxListeners limits — causing memory warnings and leaks.
 *
 * AFTER: This module registers exactly ONE listener per bus event at
 * import time. Each listener records the event in the replay cache (once)
 * and calls pool.fanOut() which delivers to all matching pooled connections.
 *
 * Result: bus.listenerCount("agent.event") === 1 at any client count.
 *
 * Initialization: module-load side-effect. Imported by sse-manager.ts.
 * Do NOT import this module from hot paths — it should be a one-time import.
 */

import { bus } from "../bus.ts";
import { pool, CONSOLE_THROTTLE_MS, OBSERVATION_THROTTLE_MS } from "../sse/connection-pool.ts";
import { record } from "../../realtime/replay-cache.ts";
import { TOPIC } from "../../realtime/stream-topics.ts";
import { matchesAgent }               from "../channels/agent-channel.ts";
import { matchesLifecycle }           from "../channels/lifecycle-channel.ts";
import { matchesConsole }             from "../channels/console-channel.ts";
import { matchesFile }                from "../channels/file-channel.ts";
import { matchesRuntimeVerified,
         matchesRuntimeObservation,
         matchesRuntimeSync }         from "../channels/runtime-channel.ts";
import type { RuntimePortEvent }      from "../types/event.types.ts";
import { matchesDiff }                from "../channels/diff-channel.ts";
import { matchesCheckpoint }          from "../channels/checkpoint-channel.ts";
import { matchesPreviewLifecycle }    from "../channels/preview-lifecycle-channel.ts";

// ── Unlimited listeners — the hub pattern means always exactly 1 per event ──
bus.setMaxListeners(0);

// ── agent.event ───────────────────────────────────────────────────────────────
bus.on("agent.event", (e) => {
  const seqId = record(TOPIC.AGENT, e);
  pool.fanOut(TOPIC.AGENT, e, seqId, (conn) => matchesAgent(conn, e));
});

// ── run.lifecycle ─────────────────────────────────────────────────────────────
bus.on("run.lifecycle", (e) => {
  const seqId = record(TOPIC.LIFECYCLE, e);
  pool.fanOut(TOPIC.LIFECYCLE, e, seqId, (conn) => matchesLifecycle(conn, e));
});

// ── console.log (throttled: ≤20 deliveries/sec per connection) ────────────────
bus.on("console.log", (e) => {
  const seqId = record(TOPIC.CONSOLE, e);
  pool.fanOut(TOPIC.CONSOLE, e, seqId, (conn) => matchesConsole(conn, e), CONSOLE_THROTTLE_MS);
});

// ── file.change ───────────────────────────────────────────────────────────────
bus.on("file.change", (e) => {
  const seqId = record(TOPIC.FILE, e);
  pool.fanOut(TOPIC.FILE, e, seqId, (conn) => matchesFile(conn, e));
});

// ── runtime.verified ──────────────────────────────────────────────────────────
bus.on("runtime.verified", (e) => {
  const seqId = record(TOPIC.RUNTIME_VERIFIED, e);
  pool.fanOut(TOPIC.RUNTIME_VERIFIED, e, seqId, (conn) => matchesRuntimeVerified(conn, e));
});

// ── runtime.sync — phase transitions from RuntimeStore ────────────────────────
bus.on("runtime.sync", (e) => {
  const seqId = record(TOPIC.RUNTIME_SYNC, e);
  pool.fanOut(TOPIC.RUNTIME_SYNC, e, seqId, (conn) => matchesRuntimeSync(conn, e));
});

// ── runtime.port — deterministic port-readiness events from waitForPort() ─────
// Delivers waiting/ready/timeout/failed/cancelled phases to the frontend so
// the preview overlay can show "Waiting for port…" and "Port ready" states
// without relying on optimistic polling.
bus.on("runtime.port", (e: RuntimePortEvent) => {
  const seqId = record(TOPIC.RUNTIME_PORT, e);
  pool.fanOut(
    TOPIC.RUNTIME_PORT, e, seqId,
    (conn) => conn.projectId === null || conn.projectId === e.projectId,
  );
});

// ── runtime.observation (throttled: ≤1 delivery/2s per connection) ────────────
bus.on("runtime.observation", (e) => {
  const seqId = record(TOPIC.RUNTIME_OBSERVATION, e);
  pool.fanOut(
    TOPIC.RUNTIME_OBSERVATION, e, seqId,
    (conn) => matchesRuntimeObservation(conn, e),
    OBSERVATION_THROTTLE_MS,
  );
});

// ── agent.diff ────────────────────────────────────────────────────────────────
bus.on("agent.diff", (e) => {
  const seqId = record(TOPIC.DIFF, e);
  pool.fanOut(TOPIC.DIFF, e, seqId, (conn) => matchesDiff(conn, e));
});

// ── checkpoint.event ─────────────────────────────────────────────────────────
bus.on("checkpoint.event", (e) => {
  const seqId = record(TOPIC.CHECKPOINT, e);
  pool.fanOut(TOPIC.CHECKPOINT, e, seqId, (conn) => matchesCheckpoint(conn, e));
});

// ── preview.lifecycle ─────────────────────────────────────────────────────────
bus.on("preview.lifecycle", (e) => {
  const seqId = record(TOPIC.PREVIEW_LIFECYCLE, e);
  pool.fanOut(TOPIC.PREVIEW_LIFECYCLE, e, seqId, (conn) => matchesPreviewLifecycle(conn, e));
});

// ── debug.lifecycle ───────────────────────────────────────────────────────────
// Streams autonomous debug/recovery session events to the browser so the
// AgentActionFeed can show live "Self-healing..." progress.
bus.on("debug.lifecycle", (e) => {
  const seqId = record(TOPIC.DEBUG_LIFECYCLE, e);
  pool.fanOut(
    TOPIC.DEBUG_LIFECYCLE, e, seqId,
    (conn) => conn.projectId === null || conn.projectId === e.projectId,
  );
});

// ── tool.execution ────────────────────────────────────────────────────────────
// Streams tool start/success/error phases so the browser can show live
// tool-call progress in the execution history panel and agent feed.
bus.on("tool.execution", (e) => {
  const seqId = record(TOPIC.TOOL_EXECUTION, e);
  pool.fanOut(
    TOPIC.TOOL_EXECUTION, e, seqId,
    (conn) => conn.projectId === null || conn.projectId === e.projectId,
  );
});

// ── Listener leak detection ───────────────────────────────────────────────────
// The hub pattern keeps SSE fan-out to exactly 1 listener per event type.
// However, a small number of non-SSE architectural subscribers are expected:
//   agent.event  — hub(1) + event-persist(1) + crash-responder(1) +
//                  observation-controller(1) + runtime-store(1) +
//                  preview-lifecycle-bridge(1) + console-orchestrator(1) = 7
//   run.lifecycle — hub(1) + recovery-manager(1) + emergency-recovery(1) = 3
// LEAK_THRESHOLD is set to 10 to catch genuine regressions (old per-connection
// pattern) without false-positives from these 7 known legitimate subscribers.
const LEAK_THRESHOLD = 10;
const WATCHED_EVENTS = [
  "agent.event", "run.lifecycle", "console.log", "file.change",
  "runtime.verified", "runtime.observation", "runtime.port", "agent.diff", "checkpoint.event",
  "preview.lifecycle", "debug.lifecycle", "tool.execution",
] as const;

const _leakTimer = setInterval(() => {
  for (const name of WATCHED_EVENTS) {
    const count = bus.listenerCount(name as any);
    if (count > LEAK_THRESHOLD) {
      console.warn(
        `[subscription-manager] LISTENER LEAK DETECTED: "${name}" has ${count} listeners ` +
        `(expected ≤ ${LEAK_THRESHOLD}). Check for unremoved bus.subscribe() / bus.on() calls.`,
      );
    }
  }
}, 30_000);
_leakTimer.unref?.();

console.log("[subscription-manager] Hub pattern active — 1 listener per bus event.");
