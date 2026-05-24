/**
 * dag-verify-executor.ts
 *
 * CRITICAL FIX: Subscribes to "dag.verify.execute" bus events and runs the
 * REAL verification engine to fulfill the DAG verify-node promise handshake.
 *
 * Root cause of gap (pre-fix):
 *   node-executor.ts dispatchVerify() emits "dag.verify.execute" + registers a
 *   promise. Nothing subscribed → verify nodes silently timed out (fake pass).
 *
 * Verification contract:
 *   1.  node-executor   →  bus.emit("agent.event", { eventType: "dag.verify.execute", … })
 *   2.  THIS MODULE     →  picks up event, calls verificationBridge.verify()
 *   3.  THIS MODULE     →  agentPromiseRegistry.resolve(promiseKey, verificationResult)
 *   4.  node-executor   →  DAG proceeds only if verification passed
 *
 * Fail-closed design:
 *   - Any caught exception rejects the promise (node marked failed).
 *   - A verification result with passed:false also rejects (no silent skip).
 *   - Timeout on the underlying check propagates as rejection.
 *
 * Single responsibility: translate "dag.verify.execute" event → real verification.
 */

import { bus }                    from "../../infrastructure/events/bus.ts";
import { agentPromiseRegistry }   from "./agent-promise-registry.ts";
import { verificationBridge }     from "../../orchestration/agents/verification-bridge.ts";
import type { VerificationCheck } from "../../orchestration/agents/verification-bridge.ts";

// ── Event shape ───────────────────────────────────────────────────────────────

interface DagVerifyArgs {
  checks?:   VerificationCheck[];
  port?:     number;
  timeoutMs?: number;
  goal?:     string;
}

interface DagVerifyPayload {
  nodeId:     string;
  args:       DagVerifyArgs;
  promiseKey: string;
}

interface DagVerifyBusEvent {
  runId:     string;
  projectId: number;
  phase:     string;
  agentName: string;
  eventType: string;
  payload:   DagVerifyPayload;
  ts:        number;
}

// ── Telemetry helper ──────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "dag.verify",
    agentName: "dag-verify-executor",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Core executor ─────────────────────────────────────────────────────────────

async function executeVerify(event: DagVerifyBusEvent): Promise<void> {
  const { runId, projectId } = event;
  const { nodeId, args, promiseKey } = event.payload;
  const t0 = Date.now();

  // Default to runtime health check if no checks specified
  const checks: VerificationCheck[] = args?.checks?.length
    ? args.checks
    : ["runtime_healthy"];

  emit(runId, projectId, "dag.verify.started", { nodeId, checks });

  try {
    const bridgeResult = await verificationBridge.verify({
      runId,
      projectId,
      checks,
      port:      args?.port,
      timeoutMs: args?.timeoutMs ?? 30_000,
    });

    const durationMs = Date.now() - t0;

    emit(runId, projectId, "dag.verify.completed", {
      nodeId,
      passed:    bridgeResult.success,
      score:     bridgeResult.data?.score,
      summary:   bridgeResult.data?.summary,
      durationMs,
    });

    if (bridgeResult.success) {
      // Verification passed — DAG node succeeds
      agentPromiseRegistry.resolve(promiseKey, {
        verified: true,
        data:     bridgeResult.data,
        durationMs,
      });
    } else {
      // Verification failed — propagate as a node failure (fail-closed)
      agentPromiseRegistry.reject(
        promiseKey,
        new Error(
          `[dag-verify] Verification failed: ${bridgeResult.error ?? bridgeResult.data?.summary ?? "unknown"}`,
        ),
      );
    }

  } catch (err: unknown) {
    const error      = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - t0;

    emit(runId, projectId, "dag.verify.failed", { nodeId, error, durationMs });

    agentPromiseRegistry.reject(
      promiseKey,
      err instanceof Error ? err : new Error(error),
    );
  }
}

// ── Bus subscriber ────────────────────────────────────────────────────────────

let _wired = false;

/**
 * Wire the DAG verify executor to the bus.
 * Idempotent — safe to call multiple times.
 * Must be called during server startup (initOrchestration).
 */
export function initDagVerifyExecutor(): void {
  if (_wired) return;
  _wired = true;

  bus.on("agent.event", (event: unknown) => {
    const e = event as DagVerifyBusEvent;
    if (e?.eventType !== "dag.verify.execute") return;

    void executeVerify(e);
  });

  console.log("[dag-verify-executor] Wired — DAG verify nodes now call real verificationBridge.");
}

export function isDagVerifyExecutorWired(): boolean {
  return _wired;
}
