/**
 * server/fail-closed/retry/retry-policy-engine.ts
 *
 * RetryPolicyEngine — diverging retry with semantic blacklisting.
 *
 * Rules enforced:
 *   1. Every retry must use a DIFFERENT strategy (tracked by StrategyTracker)
 *   2. Strategies with high semantic similarity are rejected
 *   3. Retry exhaustion → HARD FAIL (never ok:true on exhaustion)
 *   4. Non-retryable failures → HARD FAIL immediately
 *   5. Delay grows with attempt count (exponential backoff)
 *
 * INVARIANT: Exhausted retries NEVER produce ok:true.
 * INVARIANT: A strategy attempted once NEVER runs again in the same run.
 */

import type { ClassifiedFailure, RetryDecision, RetryStrategy } from "../contracts/types.ts";
import { StrategyTracker } from "./strategy-tracker.ts";

const BASE_DELAY_MS  = 2_000;
const MAX_DELAY_MS   = 30_000;
const DEFAULT_MAX    = 3;

// Strategies per failure class — ordered by estimated confidence (highest first)
const STRATEGIES_BY_CLASS: Record<string, readonly RetryStrategy[]> = {
  DEPENDENCY_FAILURE: [
    { id: "npm-install-clean", name: "npm install --legacy-peer-deps", description: "Fresh dependency install", targetStage: "BUILD", estimatedConfidence: 0.85, semanticVector: ["npm", "install", "dependencies", "packages"] },
    { id: "npm-ci-clean",      name: "npm ci",                          description: "Clean install from lockfile", targetStage: "BUILD", estimatedConfidence: 0.7, semanticVector: ["npm", "ci", "lockfile", "clean"] },
  ],
  HTTP_FAILURE: [
    { id: "http-wait-1",  name: "Wait 5s then retry HTTP",   description: "Server may still be booting", targetStage: "RUNTIME", estimatedConfidence: 0.75, semanticVector: ["wait", "http", "retry", "boot"] },
    { id: "http-wait-2",  name: "Wait 15s then retry HTTP",  description: "Longer wait for slow server",  targetStage: "RUNTIME", estimatedConfidence: 0.5, semanticVector: ["wait", "http", "slow", "longer"] },
  ],
  PROCESS_FAILURE: [
    { id: "proc-restart-1", name: "Restart process", description: "Kill and restart server process", targetStage: "RUNTIME", estimatedConfidence: 0.7, semanticVector: ["restart", "process", "kill", "server"] },
    { id: "proc-wait-1",    name: "Wait for process", description: "Process may be starting up",     targetStage: "RUNTIME", estimatedConfidence: 0.5, semanticVector: ["wait", "process", "startup"] },
  ],
  VERIFICATION_TIMEOUT: [
    { id: "timeout-retry-1", name: "Retry with extended timeout", description: "First timeout may be transient", targetStage: "BUILD", estimatedConfidence: 0.6, semanticVector: ["timeout", "retry", "extend"] },
  ],
  PREVIEW_FAILURE: [
    { id: "preview-wait-1", name: "Wait for hydration", description: "React hydration may be slow", targetStage: "PREVIEW", estimatedConfidence: 0.5, semanticVector: ["preview", "wait", "hydration", "react"] },
  ],
};

export class RetryPolicyEngine {
  private readonly _tracker = new StrategyTracker();

  decide(
    failure: ClassifiedFailure,
    attemptsSoFar: number,
    maxRetries: number = DEFAULT_MAX,
  ): RetryDecision {
    // Rule 1: Non-retryable failures → hard fail immediately
    if (!failure.retryable) {
      return {
        shouldRetry: false,
        reason:      `Failure class ${failure.class} is non-retryable: ${failure.detail}`,
        hardFail:    true,
      };
    }

    // Rule 2: Exhausted retries → hard fail (NEVER ok:true)
    if (attemptsSoFar >= maxRetries) {
      this._tracker.record(
        { id: "exhausted", name: "exhausted", description: "retries exhausted", targetStage: failure.stage, estimatedConfidence: 0, semanticVector: [] },
        "blacklisted"
      );
      return {
        shouldRetry: false,
        reason:      `Retry limit reached (${maxRetries}). Verification exhaustion ALWAYS fails. Stage: ${failure.stage}`,
        hardFail:    true,
      };
    }

    // Rule 3: Find viable (unseen, dissimilar) strategy
    const candidates = STRATEGIES_BY_CLASS[failure.class] ?? [];
    const viable     = this._tracker.filterViable(candidates);

    if (viable.length === 0) {
      return {
        shouldRetry: false,
        reason:      `No viable retry strategies remaining for ${failure.class}. All strategies exhausted or too similar.`,
        hardFail:    true,
      };
    }

    const strategy  = viable[0];
    const delayMs   = Math.min(BASE_DELAY_MS * Math.pow(2, attemptsSoFar), MAX_DELAY_MS);

    return { shouldRetry: true, strategy, delayMs };
  }

  recordOutcome(strategy: RetryStrategy, succeeded: boolean): void {
    this._tracker.record(strategy, succeeded ? "failed" : "blacklisted");
  }

  async wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Aborted")); }, { once: true });
    });
  }

  get attemptCount(): number { return this._tracker.attemptCount(); }
}
