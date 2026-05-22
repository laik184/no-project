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
import { waitForPort }            from "./wait-for-port/index.ts";
import { verifyStartup }          from "../../runtime/verification/startup-verifier.ts";
import { getLifecycleManager }    from "../../preview/lifecycle/preview-lifecycle.manager.ts";
import { bus }                    from "../events/bus.ts";
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
   *
   * NEW FLOW:
   *   ensureProjectDir → spawn → waitForPort (TCP) → verifyStartup → emit lifecycle events
   *
   * Guarantees:
   *   - runtime.ready is NEVER emitted until TCP port accepts connections
   *   - preview NEVER transitions to "ready" on a timeout or verification failure
   *   - fail-closed: returns ready=false on any non-healthy outcome
   *
   * Callers that need a fire-and-forget start (e.g. the restart coordinator
   * which manages its own port-wait loop) should use start() instead.
   */
  async startDeterministic(
    projectId: number,
    opts?: DeterministicStartOptions,
  ): Promise<DeterministicStartResult> {
    const preview = getLifecycleManager(projectId);

    // ── Step 1: Spawn ──────────────────────────────────────────────────────────
    await ensureProjectDir(projectId);
    const cwd         = getProjectDir(projectId);
    const startResult = await processRegistry.start({ projectId, cwd, ...opts });

    if (!startResult.ok) {
      return { ...startResult, ready: false };
    }
    if (startResult.alreadyRunning) {
      return { ...startResult, ready: true };
    }

    const { port } = startResult;
    if (!port) {
      preview.forceTransition("crashed", "Runtime started but no port was allocated.");
      return { ...startResult, ready: false, error: "no port allocated" };
    }

    const runId = opts?.runId;
    preview.forceTransition("starting", `Process spawned (pid=${startResult.pid}) — waiting for port ${port}…`);

    // ── Step 2: Wait for TCP port readiness ────────────────────────────────────
    const portResult = await waitForPort({
      host:            "127.0.0.1",
      port,
      timeoutMs:       opts?.waitTimeoutMs   ?? 30_000,
      retryIntervalMs: opts?.retryIntervalMs ?? 250,
      signal:          opts?.signal,
      projectId,
      runId,
    });

    if (!portResult.success) {
      // fail-closed — runtime.ready MUST NOT emit, preview MUST NOT load
      preview.forceTransition(
        "crashed",
        `Port ${port} never became reachable (${portResult.phase}): ${portResult.error}`,
      );
      bus.emit("runtime.observation", {
        projectId, status: "crashed", port,
        recentErrors: [portResult.error ?? `port ${port} timeout`],
        errorCount: 1, uptimeMs: 0, ts: Date.now(),
      });
      return {
        ...startResult,
        ready:      false,
        portWaitMs: portResult.durationMs,
        error:      portResult.error,
      };
    }

    preview.forceTransition("verifying", `Port ${port} accepting connections — verifying server health…`);

    // ── Step 3: Startup verification ───────────────────────────────────────────
    const verification = await verifyStartup(projectId, port);

    if (verification.outcome === "failed") {
      // fail-closed — do NOT emit runtime.ready
      preview.forceTransition("crashed", `Server unhealthy after startup: ${verification.llmSummary}`);
      bus.emit("runtime.observation", {
        projectId, status: "crashed", port,
        recentErrors: [verification.llmSummary],
        errorCount: 1, uptimeMs: 0, ts: Date.now(),
      });
      return {
        ...startResult,
        ready:      false,
        portWaitMs: portResult.durationMs,
        error:      verification.llmSummary,
      };
    }

    // ── Step 4: Deterministic ready — emit lifecycle events ────────────────────
    // runtime.verified drives preview-lifecycle-bridge → verifying → ready
    bus.emit("runtime.verified", {
      projectId,
      outcome:   verification.outcome,
      port,
      summary:   verification.summary,
      analysis:  verification.analysis,
      probe:     verification.probe,
      elapsedMs: verification.elapsedMs,
      ts:        Date.now(),
    });

    // runtime.observation keeps runtime-store + SSE clients in sync
    bus.emit("runtime.observation", {
      projectId, status: "healthy", port,
      recentErrors: [], errorCount: 0, uptimeMs: 0, ts: Date.now(),
    });

    console.log(
      `[runtime-manager] project=${projectId} deterministic startup complete ` +
      `— port=${port} portWait=${portResult.durationMs}ms outcome=${verification.outcome}`,
    );

    return {
      ...startResult,
      ready:               true,
      portWaitMs:          portResult.durationMs,
      verificationOutcome: verification.outcome,
    };
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
