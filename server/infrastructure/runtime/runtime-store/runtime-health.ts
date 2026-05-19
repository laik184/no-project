/**
 * runtime-store/runtime-health.ts
 *
 * Smart health monitoring — replaces the 15s poll-only approach with:
 *   • 3s PID liveness checks (instead of 15s)
 *   • stdout-activity window: if no output for STALE_MS and process is
 *     "running", emit a warning event so recovery can kick in
 *   • startup timeout: if process stays in "starting" for START_TIMEOUT_MS
 *     without producing a ready signal, emit a stuck event
 *
 * Stateless design: receives snapshot getters and emits via callbacks.
 * No imports from processRegistry — prevents circular dependencies.
 */

import { isPidAlive } from "../../process/process-recovery.ts";

// ─── Tunables ─────────────────────────────────────────────────────────────────

const POLL_MS          =  3_000;   // PID liveness check interval (was 15s)
const STALE_ACTIVITY_MS = 30_000;  // stdout silence threshold for healthy procs
const START_TIMEOUT_MS  = 60_000;  // max time allowed in "starting" state

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthEntry {
  projectId:    number;
  pid:          number;
  status:       string;          // "starting" | "running" | ...
  lastActivity: number;          // timestamp of last stdout/stderr byte
  startedAt:    number;
}

export interface HealthCallbacks {
  onCrash(projectId: number, pid: number, source: string): void;
  onHeartbeat?(projectId: number): void;
  onStale?(projectId: number): void;
  onStartTimeout?(projectId: number): void;
}

export interface SmartHealthMonitor {
  stop(): void;
}

// ─── Monitor ──────────────────────────────────────────────────────────────────

export function startSmartHealthMonitor(
  getEntries: () => HealthEntry[],
  callbacks:  HealthCallbacks,
  pollMs = POLL_MS,
): SmartHealthMonitor {
  const timer = setInterval(() => {
    const now     = Date.now();
    const entries = getEntries();

    for (const entry of entries) {
      const active = entry.status === "running" || entry.status === "starting";
      if (!active) continue;

      if (!isPidAlive(entry.pid)) {
        callbacks.onCrash(entry.projectId, entry.pid, "health-monitor");
        continue;
      }

      // Alive — update heartbeat
      callbacks.onHeartbeat?.(entry.projectId);

      // Check for stdout stale (only for "running" processes)
      if (entry.status === "running") {
        const silenceMs = now - entry.lastActivity;
        if (silenceMs > STALE_ACTIVITY_MS) {
          callbacks.onStale?.(entry.projectId);
        }
      }

      // Check for startup timeout
      if (entry.status === "starting") {
        const startAge = now - entry.startedAt;
        if (startAge > START_TIMEOUT_MS) {
          callbacks.onStartTimeout?.(entry.projectId);
        }
      }
    }
  }, pollMs);

  if (timer.unref) timer.unref();

  return { stop: () => clearInterval(timer) };
}
