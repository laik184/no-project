/**
 * runtime-store/runtime-recovery.ts
 *
 * Self-healing coordinator.
 *
 * When a crash is detected, this module:
 *   1. Marks the project as "recovering" in the runtime store.
 *   2. Emits a "debug.lifecycle" bus event (self_healing_start) so the
 *      preview lifecycle overlay shows the AI recovery animation.
 *   3. Delegates actual recovery to the crash-responder (which triggers
 *      the AI agent). This module does NOT run AI logic directly.
 *   4. Enforces a minimum recovery interval (no tight restart loops).
 *   5. After MAX_RETRIES, forces "failed" state and stops retrying.
 */

import { bus } from "../../events/bus.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_RECOVERY_INTERVAL_MS = 5_000;
const MAX_RETRIES               = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecoveryEntry {
  projectId:    number;
  retries:      number;
  lastAttempt:  number;
  sessionId:    string;
}

// ─── Recovery Manager ─────────────────────────────────────────────────────────

class RuntimeRecovery {
  private entries = new Map<number, RecoveryEntry>();

  /**
   * Attempt recovery for a crashed project.
   * Returns false if recovery is blocked (too soon / max retries).
   */
  attempt(projectId: number): boolean {
    const now     = Date.now();
    const entry   = this.entries.get(projectId) ?? {
      projectId,
      retries:     0,
      lastAttempt: 0,
      sessionId:   `recovery-${projectId}-${now}`,
    };

    // Rate limit
    if (now - entry.lastAttempt < MIN_RECOVERY_INTERVAL_MS) return false;

    // Max retries
    if (entry.retries >= MAX_RETRIES) {
      console.warn(`[runtime-recovery] Project ${projectId} exceeded max retries (${MAX_RETRIES})`);
      this.emitFailed(projectId);
      return false;
    }

    entry.retries++;
    entry.lastAttempt = now;
    entry.sessionId   = `recovery-${projectId}-${now}`;
    this.entries.set(projectId, entry);

    // Signal the preview lifecycle overlay
    bus.emit("debug.lifecycle" as any, {
      projectId,
      eventType:  "self_healing_start",
      sessionId:  entry.sessionId,
      payload:    { retries: entry.retries },
      ts:         now,
    });

    console.log(
      `[runtime-recovery] Recovery attempt ${entry.retries}/${MAX_RETRIES} ` +
      `for project ${projectId} (session: ${entry.sessionId})`
    );

    return true;
  }

  /** Call when a project recovers successfully (resets retry counter). */
  resolved(projectId: number): void {
    const entry = this.entries.get(projectId);
    if (!entry) return;
    entry.retries     = 0;
    entry.lastAttempt = 0;
    this.entries.set(projectId, entry);

    bus.emit("debug.lifecycle" as any, {
      projectId,
      eventType: "complete",
      sessionId: entry.sessionId,
      payload:   {},
      ts:        Date.now(),
    });
  }

  /** Retrieves retry count (for telemetry). */
  getEntry(projectId: number): RecoveryEntry | undefined {
    return this.entries.get(projectId);
  }

  private emitFailed(projectId: number): void {
    bus.emit("debug.lifecycle" as any, {
      projectId,
      eventType: "failed",
      sessionId: `recovery-${projectId}`,
      payload:   { reason: "max-retries-exceeded" },
      ts:        Date.now(),
    });
  }
}

export const runtimeRecovery = new RuntimeRecovery();
