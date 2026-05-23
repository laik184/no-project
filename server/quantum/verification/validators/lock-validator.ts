/**
 * server/quantum/verification/validators/lock-validator.ts
 *
 * Validates that the file lock subsystem has no stale locks.
 * Stale locks (expired but not released) can block write operations
 * indefinitely. Note: this validator warns but does NOT hard-fail
 * (the stale-lock cleaner runs on an interval and self-heals).
 */

import { fileLockManager } from "../../../quantum/locks/index.ts";
import {
  emitValidation,
  type ValidationResult, type ValidationCheck,
} from "./validator-helpers.ts";

/**
 * Validates no stale locks are held in the file lock subsystem.
 * Returns a non-throwing ValidationResult even when stale locks exist.
 */
export function validateLocks(runId: string): ValidationResult {
  const t0     = Date.now();
  const checks: ValidationCheck[] = [];

  const stats      = fileLockManager.stats();
  const staleLocks = (stats as any).stale ?? 0;
  const staleOk    = staleLocks === 0;

  checks.push({
    name:   "locks.no_stale",
    passed: staleOk,
    detail: staleOk
      ? undefined
      : `${staleLocks} stale lock(s) detected — run stale cleaner`,
  });

  const allPassed = checks.every(c => c.passed);
  emitValidation(runId, "lock", allPassed, checks);

  // Stale locks: warn but don't hard-fail — cleaner runs on interval
  return { passed: allPassed, category: "lock", checks, durationMs: Date.now() - t0 };
}
