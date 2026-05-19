/**
 * process-health.ts
 *
 * Periodic liveness monitor for running project processes.
 *
 * Every HEALTH_INTERVAL_MS:
 *   1. Walk all "running" or "starting" entries.
 *   2. Check PID liveness via kill(pid, 0).
 *   3. If dead → call onCrash(projectId) so the registry can update state.
 *   4. Update lastHeartbeat on alive processes.
 *
 * Design constraints:
 *   - Stateless: receives a snapshot getter, calls callbacks.
 *   - No imports from process-registry (prevents circular deps).
 *   - Returns a HealthMonitor handle for clean teardown.
 */

import { isPidAlive } from "./process-recovery.ts";
import type { ProcessStatus } from "./process-types.ts";

const HEALTH_INTERVAL_MS = 3_000; // 3 seconds (was 15s — faster crash detection)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthEntry {
  projectId: number;
  pid: number;
  status: ProcessStatus;
}

export interface HealthMonitor {
  stop(): void;
}

export interface HealthCallbacks {
  /** Called when a previously-alive process is no longer alive. */
  onCrash(projectId: number, pid: number): void;
  /** Called on each heartbeat for alive processes (optional). */
  onHeartbeat?(projectId: number): void;
}

// ─── Monitor ─────────────────────────────────────────────────────────────────

/**
 * Start the health monitor.
 *
 * @param getEntries  Callback that returns current live entries each tick.
 * @param callbacks   Handlers for crash / heartbeat events.
 * @param intervalMs  Override interval (useful in tests).
 */
export function startHealthMonitor(
  getEntries: () => HealthEntry[],
  callbacks: HealthCallbacks,
  intervalMs = HEALTH_INTERVAL_MS
): HealthMonitor {
  const timer = setInterval(() => {
    const entries = getEntries();
    for (const entry of entries) {
      if (entry.status !== "running" && entry.status !== "starting") continue;

      if (isPidAlive(entry.pid)) {
        callbacks.onHeartbeat?.(entry.projectId);
      } else {
        callbacks.onCrash(entry.projectId, entry.pid);
      }
    }
  }, intervalMs);

  // Don't hold the Node event loop open just for health checks
  if (timer.unref) timer.unref();

  return {
    stop(): void {
      clearInterval(timer);
    },
  };
}
