/**
 * server/fail-closed/recovery/recovery-coordinator.ts
 *
 * RecoveryCoordinator — orchestrates the recovery → rollback → reverify cycle.
 *
 * Recovery lifecycle:
 *   FAILED → RECOVERY_REQUIRED → ROLLING_BACK → REVERIFYING
 *   or
 *   FAILED → HALTED (if no recoverable checkpoint)
 *
 * After rollback, the system re-enters the full verification pipeline.
 * If reverification fails again → HALTED (no infinite loops).
 *
 * INVARIANT: Recovery is allowed exactly ONCE per run.
 * INVARIANT: If recovery fails, the system HALTS — no further attempts.
 */

import type { Checkpoint, ClassifiedFailure } from "../contracts/types.ts";
import type { VerificationStateMachine }  from "../state-machine/verification-state-machine.ts";
import type { CheckpointManager }         from "./checkpoint-manager.ts";
import type { RollbackExecutor }          from "./rollback-executor.ts";
import type { VerificationAuditLog }      from "../audit/verification-audit-log.ts";

export type RecoveryOutcome =
  | { proceeded: true;  checkpointId: string; grade: string }
  | { proceeded: false; reason: string; halted: boolean };

export class RecoveryCoordinator {
  private _recoveryAttempted = false;

  constructor(
    private readonly _checkpoints: CheckpointManager,
    private readonly _rollback:    RollbackExecutor,
    private readonly _machine:     VerificationStateMachine,
    private readonly _audit:       VerificationAuditLog,
  ) {}

  /**
   * Attempt recovery after a FAILED state.
   * Returns the outcome — caller decides whether to re-enter pipeline.
   */
  async recover(
    projectId: number,
    failure: ClassifiedFailure,
  ): Promise<RecoveryOutcome> {
    // One recovery attempt per run — no infinite loops
    if (this._recoveryAttempted) {
      this._machine.forceTerminal("HALTED", "Recovery already attempted once — cannot recover again");
      this._audit.systemHalted("Double-recovery prevented: system halted");
      return { proceeded: false, reason: "Recovery already attempted once", halted: true };
    }
    this._recoveryAttempted = true;

    // Non-recoverable failures skip rollback and go straight to HALTED
    if (!failure.recoverable) {
      this._machine.forceTerminal("HALTED",
        `Failure class ${failure.class} is non-recoverable: ${failure.detail}`
      );
      this._audit.systemHalted(`Non-recoverable failure: ${failure.class}`);
      return { proceeded: false, reason: `${failure.class} is non-recoverable`, halted: true };
    }

    // Find best recoverable checkpoint
    const checkpoint = this._checkpoints.bestRecoverable(projectId);
    if (!checkpoint) {
      this._machine.forceTerminal("HALTED", "No recoverable checkpoint available — system halted");
      this._audit.systemHalted("No GRADE_A/B checkpoint found — halted");
      return { proceeded: false, reason: "No recoverable checkpoint available", halted: true };
    }

    // ── Transition to RECOVERY_REQUIRED ──────────────────────────────────────
    this._machine.transition("RECOVERY_REQUIRED", `Failure: ${failure.detail}`);
    this._audit.recoveryStarted(
      `Attempting recovery to checkpoint ${checkpoint.id} (${checkpoint.grade})`
    );

    // ── Execute rollback ──────────────────────────────────────────────────────
    this._machine.transition("ROLLING_BACK", `Rolling back to ${checkpoint.id}`);
    const rollbackResult = await this._rollback.execute(checkpoint);

    if (!rollbackResult.ok) {
      this._machine.forceTerminal("HALTED", `Rollback failed: ${rollbackResult.reason}`);
      this._audit.systemHalted(`Rollback failed: ${rollbackResult.reason}`);
      return { proceeded: false, reason: rollbackResult.reason, halted: true };
    }

    this._audit.rollbackExecuted(rollbackResult.detail);

    // ── Transition to REVERIFYING (caller will re-run pipeline) ──────────────
    this._machine.transition("REVERIFYING", `Rollback to ${checkpoint.id} succeeded`);
    this._audit.record("REVERIFICATION_STARTED",
      `Re-entering pipeline after rollback to checkpoint ${checkpoint.id}`
    );

    return { proceeded: true, checkpointId: checkpoint.id, grade: checkpoint.grade };
  }

  get recoveryAttempted(): boolean { return this._recoveryAttempted; }
}
