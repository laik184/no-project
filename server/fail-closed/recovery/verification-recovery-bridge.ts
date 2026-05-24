/**
 * server/fail-closed/recovery/verification-recovery-bridge.ts
 *
 * VerificationRecoveryBridge — connects parallel verification failures
 * to the autonomous recovery infrastructure.
 *
 * Responsibilities:
 *   ✅ verification failure recovery (runtime restart hooks)
 *   ✅ preview recovery hooks
 *   ✅ reflection trigger on terminal failure
 *   ✅ telemetry emission for all recovery actions
 *
 * INVARIANT: Recovery is attempted at most once per pipeline run.
 * INVARIANT: Non-recoverable failures go directly to HALTED.
 */

import type { ClassifiedFailure }         from "../contracts/types.ts";
import type { WaveId }                    from "../contracts/parallel-contracts.ts";
import { bus }                            from "../../infrastructure/events/bus.ts";
import { verificationTelemetry }          from "../../telemetry/verification-telemetry.ts";

export type BridgeRecoveryResult =
  | { attempted: true;  strategy: string; detail: string }
  | { attempted: false; reason: string };

export class VerificationRecoveryBridge {
  private _used = false;

  constructor(
    private readonly runId: string,
    private readonly projectId: number,
  ) {}

  /**
   * Attempt recovery for a failed wave. Only one attempt is allowed per bridge.
   * Returns attempted:false if already used or failure is non-recoverable.
   */
  async recover(
    waveId: WaveId,
    failure: ClassifiedFailure,
  ): Promise<BridgeRecoveryResult> {
    if (this._used) {
      return { attempted: false, reason: "Recovery already attempted for this pipeline run" };
    }

    if (!failure.recoverable) {
      this._emitReflection(waveId, failure, "non-recoverable");
      return { attempted: false, reason: `${failure.class} is non-recoverable` };
    }

    this._used = true;

    // ── Runtime recovery hook ─────────────────────────────────────────────────
    if (failure.class === "PROCESS_FAILURE" || failure.class === "CRASH_LOOP") {
      verificationTelemetry.runtimeFailed(this.runId, this.projectId, failure.detail);
      bus.emit("agent.event" as any, {
        runId: this.runId, projectId: this.projectId,
        eventType: "recovery.triggered",
        phase: "verification",
        payload: { reason: failure.class, waveId, action: "runtime_restart" },
      });
      return { attempted: true, strategy: "runtime_restart", detail: failure.detail };
    }

    // ── Preview recovery hook ─────────────────────────────────────────────────
    if (failure.class === "PREVIEW_FAILURE" || failure.class === "HTTP_FAILURE") {
      verificationTelemetry.previewFailed(this.runId, this.projectId, failure.detail);
      bus.emit("agent.event" as any, {
        runId: this.runId, projectId: this.projectId,
        eventType: "recovery.triggered",
        phase: "verification",
        payload: { reason: failure.class, waveId, action: "preview_refresh" },
      });
      return { attempted: true, strategy: "preview_refresh", detail: failure.detail };
    }

    // ── Generic recovery + reflection ─────────────────────────────────────────
    this._emitReflection(waveId, failure, "generic_recovery");
    bus.emit("agent.event" as any, {
      runId: this.runId, projectId: this.projectId,
      eventType: "recovery.triggered",
      phase: "verification",
      payload: { reason: failure.class, waveId, action: "generic" },
    });

    return { attempted: true, strategy: "generic", detail: failure.detail };
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _emitReflection(waveId: WaveId, failure: ClassifiedFailure, strategy: string): void {
    bus.emit("agent.event" as any, {
      runId: this.runId, projectId: this.projectId,
      eventType: "agent.event",
      phase: "verification.reflection",
      payload: {
        waveId,
        failureClass: failure.class,
        failureDetail: failure.detail,
        strategy,
        subsystem: "verification-recovery-bridge",
      },
    });
  }

  get recoveryUsed(): boolean { return this._used; }
}
