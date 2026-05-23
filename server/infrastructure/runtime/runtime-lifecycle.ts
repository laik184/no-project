/**
 * runtime-lifecycle.ts
 *
 * Deterministic startup lifecycle — extracted from runtime-manager.ts (Phase 1 split).
 *
 * Single responsibility: deterministic spawn → port-wait → verify → emit lifecycle events.
 * Fail-closed: returns ready=false on ANY non-healthy outcome.
 *
 * Callers that need fire-and-forget start (e.g. restart coordinator) use start() instead.
 */

import { processRegistry }     from "../process/process-registry.ts";
import { ensureProjectDir, getProjectDir } from "../sandbox/sandbox.util.ts";
import { waitForPort }          from "./wait-for-port/index.ts";
import { verifyStartup }        from "../../runtime/verification/startup-verifier.ts";
import { getLifecycleManager }  from "../../preview/lifecycle/preview-lifecycle.manager.ts";
import { bus }                  from "../events/bus.ts";
import type {
  DeterministicStartOptions,
  DeterministicStartResult,
  RuntimeStartOptions,
} from "./runtime-types.ts";

// ── Deterministic startup ─────────────────────────────────────────────────────

/**
 * Start the dev server and deterministically wait for it to be ready.
 *
 * Flow:
 *   ensureProjectDir → spawn → waitForPort (TCP) → verifyStartup → emit lifecycle events
 *
 * Guarantees:
 *   - runtime.ready is NEVER emitted until TCP port accepts connections
 *   - preview NEVER transitions to "ready" on timeout or verification failure
 *   - fail-closed: returns ready=false on any non-healthy outcome
 */
export async function startDeterministic(
  projectId: number,
  opts?:     DeterministicStartOptions,
): Promise<DeterministicStartResult> {
  const preview = getLifecycleManager(projectId);

  // ── Step 1: Spawn ─────────────────────────────────────────────────────────
  await ensureProjectDir(projectId);
  const cwd         = getProjectDir(projectId);
  const startResult = await processRegistry.start({ projectId, cwd, ...(opts as RuntimeStartOptions) });

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
  preview.forceTransition(
    "starting",
    `Process spawned (pid=${startResult.pid}) — waiting for port ${port}…`,
  );

  // ── Step 2: Wait for TCP port readiness ──────────────────────────────────
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

  preview.forceTransition(
    "verifying",
    `Port ${port} accepting connections — verifying server health…`,
  );

  // ── Step 3: Startup verification ─────────────────────────────────────────
  const verification = await verifyStartup(projectId, port);

  if (verification.outcome === "failed") {
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

  // ── Step 4: Deterministic ready — emit lifecycle events ───────────────────
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

  bus.emit("runtime.observation", {
    projectId, status: "healthy", port,
    recentErrors: [], errorCount: 0, uptimeMs: 0, ts: Date.now(),
  });

  console.log(
    `[runtime-lifecycle] project=${projectId} deterministic startup complete ` +
    `— port=${port} portWait=${portResult.durationMs}ms outcome=${verification.outcome}`,
  );

  return {
    ...startResult,
    ready:               true,
    portWaitMs:          portResult.durationMs,
    verificationOutcome: verification.outcome,
  };
}
