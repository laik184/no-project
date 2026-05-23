/**
 * safe-write-policy-engine.ts
 *
 * Evaluates write requests against safety policies before execution.
 * Fail-closed: any ambiguity blocks the write.
 *
 * Single responsibility: policy evaluation only — no I/O, no side effects.
 *
 * Policies enforced:
 *   1. Ownership must be registered (no orphaned writes)
 *   2. runId must not be "unknown" for file mutations
 *   3. filePath must be an absolute path (no relative escapes)
 *   4. Queue depth must not exceed block threshold (checked via backpressure)
 */

import type { QueueKey } from "./memory-types.ts";
import type { PolicyDecision } from "./queue.types.ts";
import { memoryOwnershipRegistry } from "./memory-ownership-registry.ts";

// ── Input ─────────────────────────────────────────────────────────────────────

export interface PolicyInput {
  requestId: string;
  ownerId:   string;
  runId:     string;
  filePath:  string;
  queueKey:  QueueKey;
  attempt:   number;
}

// ── Engine ────────────────────────────────────────────────────────────────────

class SafeWritePolicyEngine {
  /**
   * Evaluate a write request against all safety policies.
   * Returns "allow", "block", or "throttle".
   * Any "block" must cause the write to be rejected immediately.
   */
  evaluate(input: PolicyInput): PolicyDecision {
    // 1. filePath must be absolute
    if (!input.filePath.startsWith("/")) {
      return this._block(
        "filePath must be absolute — relative paths are unsafe",
        "UNSAFE_RELATIVE_PATH",
      );
    }

    // 2. ownerId must not be empty
    if (!input.ownerId || input.ownerId.trim() === "") {
      return this._block(
        "ownerId is required — anonymous writes are not permitted",
        "MISSING_OWNER_ID",
      );
    }

    // 3. runId must not be "unknown"
    if (input.runId === "unknown") {
      return this._block(
        'runId "unknown" is ambiguous — writes must be tied to a run or "system"',
        "AMBIGUOUS_RUN_ID",
      );
    }

    // 4. Ownership token must be valid for this filePath + queueKey
    const ownershipCheck = memoryOwnershipRegistry.verify(
      input.ownerId,
      input.runId,
      input.filePath,
      input.queueKey,
    );

    if (!ownershipCheck.valid) {
      return this._block(
        `Ownership invalid: ${ownershipCheck.reason}`,
        "INVALID_OWNERSHIP",
      );
    }

    return { verdict: "allow", reason: "all policies passed", code: "OK" };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _block(reason: string, code: string): PolicyDecision {
    return { verdict: "block", reason, code };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const safeWritePolicyEngine = new SafeWritePolicyEngine();
