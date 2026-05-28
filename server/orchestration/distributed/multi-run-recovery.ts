/**
 * server/orchestration/distributed/multi-run-recovery.ts
 *
 * Multi-run recovery system: per-run strategy selection, circuit breaker,
 * and cross-run isolation. Coordinates with the parallel fabric to
 * recover failed orchestrators.
 * Orchestration-only — no tool execution, no filesystem access.
 */

import { parallelOrchestrationFabric } from './parallel-orchestration-fabric.ts';
import { bus } from '../../infrastructure/events/bus.ts';

// ── Recovery strategies ───────────────────────────────────────────────────────

export type RecoveryStrategy =
  | 'retry'
  | 'checkpoint-rollback'
  | 'full-restart'
  | 'circuit-break';

// ── Recovery attempt ──────────────────────────────────────────────────────────

export interface RecoveryAttempt {
  runId:      string;
  attemptNum: number;
  strategy:   RecoveryStrategy;
  reason:     string;
  result:     'pending' | 'success' | 'failed';
  startedAt:  Date;
}

// ── Policy ────────────────────────────────────────────────────────────────────

interface RecoveryPolicy {
  maxRetries:   number;
  retryDelayMs: number;
  minTimeout:   number;
}

const DEFAULT_POLICY: RecoveryPolicy = {
  maxRetries:   3,
  retryDelayMs: 500,
  minTimeout:   0,
};

// ── Per-run state ─────────────────────────────────────────────────────────────

interface RunRecoveryState {
  projectId:    number;
  attempts:     RecoveryAttempt[];
  circuitOpen:  boolean;
  policy:       RecoveryPolicy;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _store = new Map<string, RunRecoveryState>();

// ── Strategy selector ─────────────────────────────────────────────────────────

function selectStrategy(
  attemptNum: number,
  circuitOpen: boolean,
): RecoveryStrategy {
  if (circuitOpen) return 'circuit-break';
  if (attemptNum === 1) return 'retry';
  if (attemptNum === 2) return 'checkpoint-rollback';
  return 'full-restart';
}

// ── Public API ────────────────────────────────────────────────────────────────

export function setPolicyForRun(
  runId:     string,
  projectId: number,
  overrides: Partial<RecoveryPolicy>,
): void {
  const existing = _store.get(runId);
  const policy   = { ...DEFAULT_POLICY, ...(existing?.policy ?? {}), ...overrides };
  _store.set(runId, {
    projectId,
    attempts:    existing?.attempts ?? [],
    circuitOpen: existing?.circuitOpen ?? false,
    policy,
  });
}

export async function triggerRecovery(
  runId:     string,
  projectId: number,
  reason:    string,
): Promise<RecoveryAttempt> {
  if (!_store.has(runId)) {
    setPolicyForRun(runId, projectId, {});
  }

  const state      = _store.get(runId)!;
  const attemptNum = state.attempts.length + 1;
  const policy     = state.policy;

  // Open circuit if exceeded maxRetries
  const failedCount = state.attempts.filter(a => a.result === 'failed').length;
  if (failedCount >= policy.maxRetries) {
    state.circuitOpen = true;
  }

  const strategy = selectStrategy(attemptNum, state.circuitOpen);

  const attempt: RecoveryAttempt = {
    runId,
    attemptNum,
    strategy,
    reason,
    result:    'pending',
    startedAt: new Date(),
  };

  state.attempts.push(attempt);

  bus.emit('agent.event', {
    runId,
    message: `[multi-run-recovery] Attempt #${attemptNum} strategy=${strategy} reason="${reason}"`,
  } as never);

  // Delegate recovery action to fabric
  if (strategy !== 'circuit-break') {
    const orch = parallelOrchestrationFabric.get(runId);
    if (orch) {
      orch.recover(reason);
    }
  }

  // Apply delay
  const delay = Math.max(policy.minTimeout, policy.retryDelayMs);
  if (delay > 0) await new Promise(r => setTimeout(r, delay));

  return attempt;
}

export function resolveRecovery(runId: string, success: boolean): void {
  const state = _store.get(runId);
  if (!state) return;

  const pending = state.attempts.findLast(a => a.result === 'pending');
  if (!pending) return;

  pending.result = success ? 'success' : 'failed';

  // Update circuit breaker
  const failedCount = state.attempts.filter(a => a.result === 'failed').length;
  if (failedCount >= state.policy.maxRetries) {
    state.circuitOpen = true;
  }

  bus.emit('agent.event', {
    runId,
    message: `[multi-run-recovery] Resolved attempt #${pending.attemptNum} — ${pending.result}`,
  } as never);
}

export function getAttempts(runId: string): RecoveryAttempt[] {
  return _store.get(runId)?.attempts ?? [];
}

export function isCircuitOpen(runId: string): boolean {
  return _store.get(runId)?.circuitOpen ?? false;
}

export function clearRecoveryState(runId: string): void {
  _store.delete(runId);
}

export function stats(): {
  activeRuns:    number;
  totalAttempts: number;
  openCircuits:  number;
} {
  let totalAttempts = 0;
  let openCircuits  = 0;

  for (const state of _store.values()) {
    totalAttempts += state.attempts.length;
    if (state.circuitOpen) openCircuits++;
  }

  return {
    activeRuns:    _store.size,
    totalAttempts,
    openCircuits,
  };
}
