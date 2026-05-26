/**
 * server/infrastructure/memory/run-cleanup-manager.ts
 *
 * Central coordinator for per-run memory lifecycle.
 *
 * Subscribes to run.lifecycle and agent.event bus events, then schedules a
 * replay-safe delayed eviction of every per-run in-memory store.  Each
 * individual store owns its own cleanup function — this module only calls
 * those functions at the right time.
 *
 * Cleanup lifecycle:
 *   run.lifecycle (started)          → track start time
 *   run.lifecycle (completed/failed/cancelled)
 *                                    → schedule REPLAY_TTL_MS delayed eviction
 *   agent.event (recovery.started)   → extend TTL by RECOVERY_EXTENSION_MS
 *   agent.event (recovery.completed/failed) → unprotect run
 *   TTL fires                        → evict all per-run stores + emit telemetry
 *   stale watchdog (every 10 min)    → force-evict runs older than MAX_RUN_AGE_MS
 *
 * Telemetry events emitted on bus topic "memory.cleanup":
 *   memory.cleanup.started
 *   memory.cleanup.completed
 *   memory.cleanup.failed
 *   memory.eviction
 *   memory.retention.extended
 *   memory.leak.detected
 */

import { bus }              from "../events/bus.ts";
import { evictRunBuffer }   from "../../execution-graph/graph-builder.ts";
import { clearGraph }       from "../../execution-graph/graph-store.ts";
import { clearEvents }      from "../../telemetry/telemetry-collector.ts";
import { unregisterRun }    from "../../chat/run/registry.ts";
import { clearCheckpoints } from "../../orchestration/core/orchestration-replay.ts";
import { runManager }       from "../../orchestration/core/run-manager.ts";
import { clearContext }     from "../../orchestration/core/orchestration-context.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Delay after run completion before evicting — gives replay consumers time to read. */
const REPLAY_TTL_MS = 30_000;

/** Extra TTL granted when recovery is active within the replay window. */
const RECOVERY_EXTENSION_MS = 30_000;

/** Runs older than this are force-evicted by the stale watchdog. */
const MAX_RUN_AGE_MS = 2 * 60 * 60 * 1_000; // 2 hours

/** How often the stale watchdog fires. */
const WATCHDOG_INTERVAL_MS = 10 * 60 * 1_000; // 10 minutes

// ── Internal state ────────────────────────────────────────────────────────────

interface PendingCleanup {
  projectId:   number;
  timer:       ReturnType<typeof setTimeout>;
  scheduledAt: number;
  reason:      string;
}

/** Runs with a pending cleanup timer. */
const _pending = new Map<string, PendingCleanup>();

/** Tracks when each run started (for stale watchdog). */
const _runStartTimes = new Map<string, number>();

/** Runs shielded from cleanup while recovery is active. */
const _protected = new Set<string>();

// ── Telemetry helper ──────────────────────────────────────────────────────────

function emitMemory(
  event: string,
  runId: string,
  projectId: number,
  extra: Record<string, unknown> = {},
): void {
  bus.emit("memory.cleanup" as any, { event, runId, projectId, ts: Date.now(), ...extra });
}

// ── Core eviction ─────────────────────────────────────────────────────────────

function evictRun(runId: string, projectId: number, reason: string): void {
  const cleanupStart = Date.now();
  emitMemory("memory.cleanup.started", runId, projectId, { reason });

  try {
    evictRunBuffer(runId);
    clearGraph(runId);
    clearEvents(runId);
    unregisterRun(runId);
    clearCheckpoints(runId);
    runManager.clear(runId);
    clearContext(runId);

    _pending.delete(runId);
    _runStartTimes.delete(runId);
    _protected.delete(runId);

    const durationMs = Date.now() - cleanupStart;
    emitMemory("memory.cleanup.completed", runId, projectId, { reason, durationMs });
    emitMemory("memory.eviction", runId, projectId, { reason, durationMs });

  } catch (err) {
    emitMemory("memory.cleanup.failed", runId, projectId, {
      reason,
      error: err instanceof Error ? err.message : String(err),
    });
    console.error(`[run-cleanup-manager] Eviction failed for runId=${runId}: ${err}`);
  }
}

// ── Schedule / cancel cleanup ─────────────────────────────────────────────────

function scheduleCleanup(
  runId:     string,
  projectId: number,
  reason:    string,
  delayMs:   number,
): void {
  const existing = _pending.get(runId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    if (_protected.has(runId)) {
      emitMemory("memory.retention.extended", runId, projectId, {
        reason:      "recovery-active",
        extensionMs: RECOVERY_EXTENSION_MS,
      });
      scheduleCleanup(runId, projectId, "post-recovery", RECOVERY_EXTENSION_MS);
      return;
    }
    evictRun(runId, projectId, reason);
  }, delayMs);

  timer.unref?.();

  _pending.set(runId, { projectId, timer, scheduledAt: Date.now(), reason });
}

// ── Bus wiring ────────────────────────────────────────────────────────────────

let _initialized = false;

export function initRunCleanupManager(): void {
  if (_initialized) return;
  _initialized = true;

  bus.on("run.lifecycle", (e: any) => {
    const { runId, projectId, status } = e ?? {};
    if (!runId) return;

    if (status === "started") {
      _runStartTimes.set(runId, Date.now());
      return;
    }

    if (status === "completed" || status === "failed" || status === "cancelled") {
      scheduleCleanup(runId, projectId ?? 0, status, REPLAY_TTL_MS);
    }
  });

  bus.on("agent.event", (e: any) => {
    const { runId, projectId, eventType } = e ?? {};
    if (!runId || !eventType) return;

    if (eventType === "recovery.started") {
      _protected.add(runId);
      emitMemory("memory.retention.extended", runId, projectId ?? 0, {
        reason:      "recovery.started",
        extensionMs: RECOVERY_EXTENSION_MS,
      });
    }

    if (eventType === "recovery.completed" || eventType === "recovery.failed") {
      _protected.delete(runId);
    }
  });

  const watchdog = setInterval(() => {
    const cutoff = Date.now() - MAX_RUN_AGE_MS;
    for (const [runId, startedAt] of _runStartTimes) {
      if (startedAt < cutoff) {
        const pending   = _pending.get(runId);
        const projectId = pending?.projectId ?? 0;

        emitMemory("memory.leak.detected", runId, projectId, {
          reason:  "stale-run-watchdog",
          ageMs:   Date.now() - startedAt,
        });

        if (pending) clearTimeout(pending.timer);
        evictRun(runId, projectId, "stale-watchdog");
      }
    }
  }, WATCHDOG_INTERVAL_MS);

  watchdog.unref?.();

  console.log(
    `[run-cleanup-manager] Started — TTL=${REPLAY_TTL_MS}ms ` +
    `recoveryExtension=${RECOVERY_EXTENSION_MS}ms ` +
    `watchdog=${WATCHDOG_INTERVAL_MS}ms`,
  );
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function cleanupStats(): {
  pendingCleanups: number;
  trackedRuns:     number;
  protectedRuns:   number;
} {
  return {
    pendingCleanups: _pending.size,
    trackedRuns:     _runStartTimes.size,
    protectedRuns:   _protected.size,
  };
}
