/**
 * server/quantum/verification/validators/worker-validator.ts
 *
 * Validates that the CentralWorkerPool is in a healthy state.
 * Fail-closed: throws ParallelValidationError on unhealthy pool.
 */

import { centralWorkerPool } from "../../scheduler/worker-pool.ts";
import {
  ParallelValidationError, emitValidation,
  type ValidationResult, type ValidationCheck,
} from "./validator-helpers.ts";

/**
 * Validates worker pool health before a parallel wave executes.
 * Throws if concurrency is exceeded or pool is overloaded.
 */
export function validateWorkerPool(runId: string): ValidationResult {
  const t0     = Date.now();
  const checks: ValidationCheck[] = [];
  const stats  = centralWorkerPool.stats();

  const metrics    = stats.metrics as any;
  const active     = stats.active;
  const maxActive  = 20; // matches DEFAULT_SCHEDULER_CONFIG.maxConcurrency
  const capacityOk = active <= maxActive;
  checks.push({
    name:   "worker.capacity",
    passed: capacityOk,
    detail: capacityOk ? undefined : `Active ${active} exceeds max ${maxActive}`,
  });

  checks.push({
    name:   "worker.not_stale_draining",
    passed: !stats.draining,
    detail: stats.draining ? "Pool is draining — no new work accepted" : undefined,
  });

  const total    = (metrics?.completed ?? 0) + (metrics?.failed ?? 0);
  const failRate = total > 0 ? (metrics?.failed ?? 0) / total : 0;
  const rateOk   = failRate < 0.5;
  checks.push({
    name:   "worker.failure_rate",
    passed: rateOk,
    detail: rateOk ? undefined : `Worker failure rate ${(failRate * 100).toFixed(1)}% exceeds 50%`,
  });

  const allPassed = checks.every(c => c.passed);
  emitValidation(runId, "worker", allPassed, checks);

  if (!allPassed) {
    const failed = checks.filter(c => !c.passed).map(c => c.detail).join("; ");
    throw new ParallelValidationError("worker", "WORKER_UNHEALTHY", failed);
  }

  return { passed: true, category: "worker", checks, durationMs: Date.now() - t0 };
}
