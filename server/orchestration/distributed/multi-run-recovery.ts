/**
 * server/orchestration/distributed/multi-run-recovery.ts
 *
 * MultiRunRecoverySystem — per-run isolated crash recovery.
 *
 * Responsibilities:
 *   - Track recovery policies per run (no cross-run pollution)
 *   - Execute isolated rollback to per-run checkpoints
 *   - Apply restart policies without affecting sibling runs
 *   - Enforce max-retry circuit breaker per run
 *   - Emit telemetry on every recovery decision
 *
 * Single responsibility: recovery lifecycle per run. No agent logic.
 */

import { bus }                          from "../../infrastructure/events/bus.ts";
import { parallelOrchestrationFabric }  from "./parallel-orchestration-fabric.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecoveryStrategy = "retry" | "rollback" | "checkpoint-restore" | "circuit-break";

export interface RecoveryPolicy {
  maxRetries:       number;
  retryDelayMs:     number;
  backoffMultiplier: number;
  strategies:       RecoveryStrategy[];
}

export interface RecoveryAttempt {
  readonly runId:        string;
  readonly projectId:    number;
  readonly attemptNum:   number;
  readonly strategy:     RecoveryStrategy;
  readonly triggeredAt:  number;
  result:                "pending" | "success" | "failed";
  resolvedAt?:           number;
}

export interface RunRecoveryState {
  runId:       string;
  projectId:   number;
  attempts:    RecoveryAttempt[];
  policy:      RecoveryPolicy;
  circuitOpen: boolean;
}

// ── Default policy ─────────────────────────────────────────────────────────────

const DEFAULT_POLICY: RecoveryPolicy = {
  maxRetries:        3,
  retryDelayMs:      2_000,
  backoffMultiplier: 2,
  strategies:        ["retry", "rollback", "checkpoint-restore", "circuit-break"],
};

// ── Registry ───────────────────────────────────────────────────────────────────

const _states = new Map<string, RunRecoveryState>();

// ── Telemetry ──────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase: "multi-run-recovery",
    agentName: "multi-run-recovery",
    eventType, payload,
    ts: Date.now(),
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getOrCreate(runId: string, projectId: number): RunRecoveryState {
  const existing = _states.get(runId);
  if (existing) return existing;
  const state: RunRecoveryState = {
    runId, projectId,
    attempts:    [],
    policy:      { ...DEFAULT_POLICY },
    circuitOpen: false,
  };
  _states.set(runId, state);
  return state;
}

function currentDelay(state: RunRecoveryState): number {
  const n = state.attempts.length;
  return state.policy.retryDelayMs * Math.pow(state.policy.backoffMultiplier, n);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Configure a custom recovery policy for a run. */
export function setPolicyForRun(runId: string, projectId: number, policy: Partial<RecoveryPolicy>): void {
  const state = getOrCreate(runId, projectId);
  Object.assign(state.policy, policy);
}

/**
 * Trigger recovery for a crashed run.
 * Selects the appropriate strategy based on attempt count and policy.
 * Isolated from all other runs — no shared state mutations.
 */
export async function triggerRecovery(
  runId:     string,
  projectId: number,
  reason:    string,
): Promise<RecoveryAttempt> {
  const state    = getOrCreate(runId, projectId);
  const attemptN = state.attempts.length + 1;

  // Circuit breaker check
  if (state.circuitOpen || attemptN > state.policy.maxRetries) {
    state.circuitOpen = true;
    emit(runId, projectId, "runtime.failed", {
      reason: "circuit-open", attemptN, maxRetries: state.policy.maxRetries,
    });
    parallelOrchestrationFabric.fail(runId, "circuit-open", { attemptN });
    const attempt: RecoveryAttempt = {
      runId, projectId, attemptNum: attemptN,
      strategy: "circuit-break",
      triggeredAt: Date.now(),
      result: "failed",
      resolvedAt: Date.now(),
    };
    state.attempts.push(attempt);
    return attempt;
  }

  // Select strategy
  const stratIdx   = Math.min(attemptN - 1, state.policy.strategies.length - 1);
  const strategy   = state.policy.strategies[stratIdx] ?? "retry";
  const delayMs    = currentDelay(state);

  const attempt: RecoveryAttempt = {
    runId, projectId,
    attemptNum:  attemptN,
    strategy,
    triggeredAt: Date.now(),
    result:      "pending",
  };
  state.attempts.push(attempt);

  emit(runId, projectId, "recovery.triggered", {
    strategy, attemptN, delayMs, reason,
  });

  // Enter recovery phase
  parallelOrchestrationFabric.get(runId)?.recover(reason);

  // Delay before attempting
  await new Promise(r => setTimeout(r, delayMs));

  // Resolve attempt (consumer must call resolveRecovery)
  return attempt;
}

/** Mark a recovery attempt as resolved (success or fail). */
export function resolveRecovery(
  runId:   string,
  success: boolean,
  context: Record<string, unknown> = {},
): void {
  const state = _states.get(runId);
  if (!state) return;
  const last = state.attempts.at(-1);
  if (!last || last.result !== "pending") return;
  last.result     = success ? "success" : "failed";
  last.resolvedAt = Date.now();
  emit(runId, state.projectId, success ? "run.completed" : "runtime.failed", {
    strategy:  last.strategy,
    attemptN:  last.attemptNum,
    ...context,
  });
}

/** Get all recovery attempts for a run. */
export function getAttempts(runId: string): RecoveryAttempt[] {
  return [...(_states.get(runId)?.attempts ?? [])];
}

/** Whether a run's circuit breaker is open (permanently failed). */
export function isCircuitOpen(runId: string): boolean {
  return _states.get(runId)?.circuitOpen ?? false;
}

/** Clean up recovery state for a terminated run. */
export function clearRecoveryState(runId: string): void {
  _states.delete(runId);
}

/** Stats snapshot. */
export function stats(): { activeRuns: number; totalAttempts: number; openCircuits: number } {
  const states = Array.from(_states.values());
  return {
    activeRuns:    states.length,
    totalAttempts: states.reduce((s, r) => s + r.attempts.length, 0),
    openCircuits:  states.filter(r => r.circuitOpen).length,
  };
}
