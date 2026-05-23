/**
 * Responsibility: Fail-closed execution gate — wraps any distributed operation
 *                 with mandatory pre-validation, lock acquisition, and recovery hooks.
 *                 NO execution proceeds without passing all gates.
 * Dependencies: distributed-validator, distributed-lock-manager, retry-trace
 * Failure: throws DistributedGateError on any validation failure; never silently proceeds.
 * Telemetry: emits gate events via bus.
 */

import { distributedValidator, type ValidationResult } from "./distributed-validator.ts";
import { distributedLockManager } from "../locks/distributed-lock-manager.ts";
import { retryTrace }             from "../telemetry/retry-trace.ts";
import { bus }                    from "../../infrastructure/events/bus.ts";

export class DistributedGateError extends Error {
  constructor(
    public readonly runId:   string,
    public readonly checks:  Record<string, boolean>,
    public readonly errors:  string[],
  ) {
    super(`[fail-closed-gate] Execution blocked for run ${runId}: ${errors.join("; ")}`);
    this.name = "DistributedGateError";
  }
}

class FailClosedGate {
  /**
   * Execute fn only after passing all distributed validation gates.
   * Acquires a per-run lock to prevent concurrent execution of the same run.
   */
  async execute<T>(
    runId:     string,
    projectId: number,
    lockKey:   string,
    fn:        () => Promise<T>,
    opts:      { maxRetries?: number; timeoutMs?: number } = {},
  ): Promise<T> {
    // Validation gate
    const validation = await distributedValidator.validateExecution(runId, projectId);
    if (!validation.passed) {
      throw new DistributedGateError(runId, validation.checks, validation.errors);
    }

    // Lock gate
    return distributedLockManager.withLock(
      lockKey,
      { ownerId: runId, ttlMs: opts.timeoutMs ?? 60_000, waitMs: 5_000, autoRenewMs: 15_000 },
      async () => {
        this.emitGateOpen(runId, lockKey);
        try {
          const result = await fn();
          this.emitGateClosed(runId, lockKey, "ok");
          return result;
        } catch (err) {
          this.emitGateClosed(runId, lockKey, "error");
          throw err;
        }
      },
    );
  }

  /** Validate replay before allowing checkpoint restoration. */
  validateReplay(runId: string, checkpointVersion: number): ValidationResult {
    const result = distributedValidator.validateReplay(runId, checkpointVersion);
    if (!result.passed) {
      throw new DistributedGateError(runId, result.checks, result.errors);
    }
    return result;
  }

  private emitGateOpen(runId: string, lockKey: string): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0, phase: "distributed.gate",
        agentName: "fail-closed-gate",
        eventType: "agent.started",
        payload: { event: "gate_open", lockKey }, ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }

  private emitGateClosed(runId: string, lockKey: string, status: "ok" | "error"): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0, phase: "distributed.gate",
        agentName: "fail-closed-gate",
        eventType: status === "ok" ? "agent.completed" : "agent.failed",
        payload: { event: "gate_closed", lockKey, status }, ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }
}

export const failClosedGate = new FailClosedGate();
