/**
 * runtime-manager.ts
 *
 * THE SINGLE ENTRY POINT for all runtime operations.
 *
 * All consumers — API routes, agent tools, preview proxy, preview service —
 * import ONLY from here. No consumer should import from process-registry,
 * process-persistence, or sandbox utilities directly.
 *
 * Responsibilities:
 *   - Resolve project sandbox path (encapsulates sandbox.util)
 *   - Delegate lifecycle to ProcessRegistry (the low-level engine)
 *   - Expose a typed, ergonomic public API
 *   - Map internal ProcessEntry to the public RuntimeEntry shape
 *
 * Consumers must NOT:
 *   - Call child_process.spawn directly
 *   - Import processRegistry directly
 *   - Maintain their own process Maps or Sets
 */

import { processRegistry }        from "../process/process-registry.ts";
import {
  getProjectDir,
  ensureProjectDir,
}                                 from "../sandbox/sandbox.util.ts";
import { startDeterministic }     from "./runtime-lifecycle.ts";
import type { ProcessEntry }      from "../process/process-types.ts";
import type {
  RuntimeEntry,
  RuntimeStartOptions,
  RuntimeStartResult,
  RuntimeStopResult,
  RuntimeRestartResult,
  DeterministicStartResult,
  DeterministicStartOptions,
} from "./runtime-types.ts";

// ─── Internal mapping ─────────────────────────────────────────────────────────

function toRuntimeEntry(e: ProcessEntry): RuntimeEntry {
  return {
    projectId:    e.projectId,
    pid:          e.pid,
    port:         e.port,
    status:       e.status,
    startedAt:    e.startedAt,
    command:      e.command,
    cwd:          e.cwd,
    restartCount: e.restartCount,
    lastHeartbeat: e.lastHeartbeat,
    uptimeMs:     Date.now() - e.startedAt,
  };
}

// ─── Runtime Manager ──────────────────────────────────────────────────────────

export const runtimeManager = {

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Must be called once at server startup. Loads persisted state + starts health monitor. */
  init(): Promise<void> {
    return processRegistry.init();
  },

  /** Must be called on SIGTERM/SIGINT. Flushes state then kills all children. */
  shutdown(): Promise<void> {
    return processRegistry.shutdown();
  },

  // ── Process management ────────────────────────────────────────────────────

  /**
   * Start the dev server for a project.
   * Resolves the sandbox path automatically — callers only need a projectId.
   */
  async start(
    projectId: number,
    opts?: RuntimeStartOptions,
  ): Promise<RuntimeStartResult> {
    await ensureProjectDir(projectId);
    const cwd = getProjectDir(projectId);
    return processRegistry.start({ projectId, cwd, ...opts });
  },

  /**
   * Stop the dev server for a project.
   * No-op (ok: true) if no server is running.
   */
  stop(projectId: number): RuntimeStopResult {
    if (!processRegistry.isRunning(projectId)) {
      return { ok: true };
    }
    return processRegistry.stop(projectId);
  },

  /**
   * Restart the dev server for a project.
   * Stops the current process (if any), then starts a new one on a fresh port.
   */
  async restart(
    projectId: number,
    opts?: RuntimeStartOptions,
  ): Promise<RuntimeRestartResult> {
    await ensureProjectDir(projectId);
    const cwd = getProjectDir(projectId);
    return processRegistry.restart({ projectId, cwd, ...opts });
  },

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Get the full runtime entry for a project, or undefined if not tracked. */
  get(projectId: number): RuntimeEntry | undefined {
    const e = processRegistry.get(projectId);
    return e ? toRuntimeEntry(e) : undefined;
  },

  /** Get the live port for a project (only for running/starting processes). */
  getPort(projectId: number): number | undefined {
    return processRegistry.getPort(projectId);
  },

  /** True if the project server is running or starting. */
  isRunning(projectId: number): boolean {
    return processRegistry.isRunning(projectId);
  },

  /** Get the last N log lines for a project's server process. */
  getLogs(projectId: number, tail = 50): string[] {
    return processRegistry.getLogs(projectId, tail);
  },

  /** Remove a project entry from the registry (called on process exit). */
  remove(projectId: number): void {
    processRegistry.remove(projectId);
  },

  /** All currently tracked runtime entries. */
  all(): RuntimeEntry[] {
    return processRegistry.all().map(toRuntimeEntry);
  },

  /**
   * Start the dev server and deterministically wait for it to be ready.
   * Delegates to runtime-lifecycle.ts (Phase 1 split — keeps this file ≤250 lines).
   *
   * Callers that need fire-and-forget start (e.g. the restart coordinator)
   * should use start() instead.
   */
  startDeterministic(
    projectId: number,
    opts?:     DeterministicStartOptions,
  ): Promise<DeterministicStartResult> {
    return startDeterministic(projectId, opts);
  },

  /** Build the public preview URL for a project. */
  previewUrl(projectId: number, port?: number): string {
    const resolvedPort = port ?? processRegistry.getPort(projectId);
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}/preview/${projectId}/`;
    }
    return `http://localhost:${resolvedPort ?? "?"}`;
  },
};

export type RuntimeManager = typeof runtimeManager;
