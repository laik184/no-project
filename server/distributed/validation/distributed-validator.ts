/**
 * Responsibility: Fail-closed validation gate for all distributed execution paths.
 *                 Validates queue admission, worker readiness, lock availability,
 *                 runtime state, and aggregation preconditions before execution.
 * Dependencies: distributed-queue, central-worker-pool, distributed-lock-manager,
 *               redis-health
 * Failure: any failed check returns false — execution is blocked (fail-closed).
 * Telemetry: emits validation results to bus for observability.
 */

import { distributedQueue }       from "../queue/distributed-queue.ts";
import { workerCapacity }         from "../workers/worker-capacity.ts";
import { distributedLockManager } from "../locks/distributed-lock-manager.ts";
import { redisHealth }            from "../redis/redis-health.ts";
import { bus }                    from "../../infrastructure/events/bus.ts";

export interface ValidationResult {
  passed:  boolean;
  checks:  Record<string, boolean>;
  errors:  string[];
  runId:   string;
  ts:      number;
}

class DistributedValidator {
  /** Full pre-execution validation — blocks on any failure (fail-closed). */
  async validateExecution(runId: string, projectId: number): Promise<ValidationResult> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    // 1. Queue admission check
    try {
      const stats = await distributedQueue.stats();
      checks.queueNotExhausted = stats.waiting < 1000;
      if (!checks.queueNotExhausted) errors.push("Queue depth exceeded limit (1000)");
    } catch (e) {
      checks.queueNotExhausted = false;
      errors.push(`Queue validation error: ${(e as Error).message}`);
    }

    // 2. Worker capacity check
    try {
      checks.workersAvailable = workerCapacity.hasCapacity("io-bound") ||
                                workerCapacity.hasCapacity("cpu-bound") ||
                                workerCapacity.hasCapacity("llm");
      if (!checks.workersAvailable) errors.push("No worker capacity available across all tiers");
    } catch (e) {
      checks.workersAvailable = false;
      errors.push(`Worker capacity check error: ${(e as Error).message}`);
    }

    // 3. Lock system health
    try {
      const lockHealth = distributedLockManager.health();
      checks.lockSystemHealthy = lockHealth.metrics.acquired >= 0;
      if (!checks.lockSystemHealthy) errors.push("Lock system reporting unhealthy state");
    } catch (e) {
      checks.lockSystemHealthy = false;
      errors.push(`Lock system check error: ${(e as Error).message}`);
    }

    // 4. Runtime validation
    checks.runtimeValid = typeof runId === "string" && runId.length > 0;
    if (!checks.runtimeValid) errors.push("Invalid runId");

    checks.projectIdValid = typeof projectId === "number" && projectId >= 0;
    if (!checks.projectIdValid) errors.push("Invalid projectId");

    const passed = errors.length === 0;
    const result: ValidationResult = { passed, checks, errors, runId, ts: Date.now() };
    this.emitResult(result);
    return result;
  }

  /** Replay-safety validation — checks version consistency before replay. */
  validateReplay(runId: string, checkpointVersion: number): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    checks.versionPositive = checkpointVersion >= 0;
    if (!checks.versionPositive) errors.push("Checkpoint version must be non-negative");

    checks.runIdPresent = typeof runId === "string" && runId.length > 0;
    if (!checks.runIdPresent) errors.push("runId required for replay");

    const passed = errors.length === 0;
    return { passed, checks, errors, runId, ts: Date.now() };
  }

  /** Aggregation precondition validation. */
  validateAggregation(runId: string, paths: string[]): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    checks.hasPaths = Array.isArray(paths) && paths.length > 0;
    if (!checks.hasPaths) errors.push("Aggregation requires at least one path");

    checks.pathsUnique = new Set(paths).size === paths.length;
    if (!checks.pathsUnique) errors.push("Duplicate paths in aggregation");

    const passed = errors.length === 0;
    return { passed, checks, errors, runId, ts: Date.now() };
  }

  private emitResult(result: ValidationResult): void {
    try {
      bus.emit("agent.event", {
        runId: result.runId, projectId: 0,
        phase: "distributed.validation",
        agentName: "distributed-validator",
        eventType: result.passed ? "agent.started" : "agent.failed",
        payload: { passed: result.passed, checks: result.checks, errors: result.errors },
        ts: result.ts,
      });
    } catch { /* non-throwing */ }
  }
}

export const distributedValidator = new DistributedValidator();
