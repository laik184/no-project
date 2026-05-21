/**
 * server/runtime-truth/recovery-signal-emitter.ts
 *
 * RecoverySignalEmitter — decides recovery actions and emits a typed signal.
 * Maps failure stage → recommended RecoveryAction set.
 * Emits RECOVERY_TRIGGERED on the event bus.
 * Stateless beyond routing table. No direct subprocess control.
 */

import { randomUUID } from "crypto";
import type {
  RecoverySignal,
  RecoveryAction,
  VerificationStage,
  RuntimeHealthState,
} from "./types.ts";
import type { RuntimeEventBus } from "./event-bus.ts";

// ─── Stage → action mapping ───────────────────────────────────────────────────

const STAGE_ACTIONS: Record<VerificationStage, readonly RecoveryAction[]> = {
  filesystem:       ["STATE_RECONCILIATION"],
  import_graph:     ["VERIFICATION_REPLAY", "STATE_RECONCILIATION"],
  typescript:       ["VERIFICATION_REPLAY"],
  dependencies:     ["DEPENDENCY_REINSTALL", "PROCESS_RESTART"],
  process_health:   ["PROCESS_RESTART", "STATE_RECONCILIATION"],
  http_health:      ["PROCESS_RESTART"],
  preview_behavior: ["PROCESS_RESTART", "VERIFICATION_REPLAY"],
};

const STATE_ACTIONS: Partial<Record<RuntimeHealthState, readonly RecoveryAction[]>> = {
  FAILED:    ["PROCESS_RESTART", "STATE_RECONCILIATION"],
  DEGRADED:  ["PROCESS_RESTART"],
  HALTED:    ["ROLLBACK"],
};

// ─── Consecutive failure tracking ─────────────────────────────────────────────

const _failureCounts = new Map<number, number>(); // projectId → count
const ROLLBACK_THRESHOLD = 5;

export class RecoverySignalEmitter {
  private readonly _bus: RuntimeEventBus;

  constructor(bus: RuntimeEventBus) {
    this._bus = bus;
  }

  emit(opts: {
    projectId: number;
    reason: string;
    failedStage: VerificationStage | null;
    currentState: RuntimeHealthState;
    correlationId: string;
  }): RecoverySignal {
    const { projectId, reason, failedStage, currentState, correlationId } = opts;

    // Track consecutive failures to escalate to rollback
    const count = (_failureCounts.get(projectId) ?? 0) + 1;
    _failureCounts.set(projectId, count);

    let actions: RecoveryAction[] = [];

    if (failedStage) {
      actions = [...(STAGE_ACTIONS[failedStage] ?? [])];
    } else {
      actions = [...(STATE_ACTIONS[currentState] ?? ["STATE_RECONCILIATION"])];
    }

    // Escalate to ROLLBACK after repeated failures
    if (count >= ROLLBACK_THRESHOLD && !actions.includes("ROLLBACK")) {
      actions.unshift("ROLLBACK");
    }

    // De-duplicate preserving order
    const unique = [...new Set(actions)] as RecoveryAction[];

    const signal: RecoverySignal = Object.freeze({
      id: randomUUID(),
      triggeredAt: Date.now(),
      reason,
      failedStage,
      recommendedActions: Object.freeze(unique),
      correlationId,
    });

    this._bus.emit("RECOVERY_TRIGGERED", correlationId, {
      signalId: signal.id,
      reason,
      failedStage,
      actions: unique,
      consecutiveFailures: count,
    });

    return signal;
  }

  resetCount(projectId: number): void {
    _failureCounts.delete(projectId);
  }

  getCount(projectId: number): number {
    return _failureCounts.get(projectId) ?? 0;
  }
}
