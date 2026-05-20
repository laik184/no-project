/**
 * recovery-bridge.ts
 *
 * Typed bridge between the orchestration engine and the recovery infrastructure.
 * Unifies crash recovery, rollback, and autonomous debug into one interface.
 */

import {
  recoverFromCrash,
  undoRun,
} from "../../infrastructure/recovery/recovery-manager.ts";
import { handleCrash }           from "../../agents/autonomous-debug/index.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }      from "../telemetry/orchestration-metrics.ts";
import { isLocked }              from "../../infrastructure/recovery/recovery-lock.ts";
import type { BridgeResult }     from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecoveryMode = "crash" | "rollback" | "autonomous_debug";

export interface RecoveryInput {
  runId:      string;
  projectId:  number;
  mode:       RecoveryMode;
  error?:     Error;
  reason?:    string;
  signal?:    AbortSignal;
}

export interface RecoveryOutput {
  mode:       RecoveryMode;
  success:    boolean;
  action:     string;
  filesFixed: number;
  retried:    boolean;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class RecoveryBridge {
  async recover(input: RecoveryInput): Promise<BridgeResult<RecoveryOutput>> {
    const { runId, projectId, mode } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, `recovery.${mode}`, {
      projectId: String(projectId),
      mode,
    });

    try {
      emitAgentCoordination({
        runId, projectId,
        agentName: "recovery",
        role:      "recovery",
        outcome:   "success",
        phase:     "heal",
      });

      let result: RecoveryOutput;

      switch (mode) {
        case "crash":
          result = await this.handleCrashRecovery({ runId, projectId, error: input.error, reason: input.reason });
          break;
        case "rollback":
          result = await this.handleRollback({ runId, projectId });
          break;
        case "autonomous_debug":
          result = await this.handleAutonomousDebug({ runId, projectId, error: input.error });
          break;
        default:
          throw new Error(`Unknown recovery mode: ${mode}`);
      }

      incrementCounter(`recovery.${mode}.${result.success ? "success" : "failed"}`, {
        projectId: String(projectId),
      });

      recordSpanEnd(spanId, result.success ? "ok" : "error");
      return {
        success:    result.success,
        data:       result,
        durationMs: Date.now() - t0,
        retryable:  !result.success,
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[recovery-bridge] Recovery (${mode}) failed: ${msg}`);
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: false };
    }
  }

  // ── Individual recovery handlers ─────────────────────────────────────────────

  private async handleCrashRecovery(opts: {
    runId:     string;
    projectId: number;
    error?:    Error;
    reason?:   string;
  }): Promise<RecoveryOutput> {
    const result = await recoverFromCrash({
      projectId: opts.projectId,
      runId:     opts.runId,
      reason:    opts.reason ?? opts.error?.message ?? "orchestration-crash",
      crashData: opts.error ? { message: opts.error.message } : undefined,
    });

    const success = "skipped" in result ? false : (result as any).success ?? false;
    return {
      mode:       "crash",
      success,
      action:     "skipped" in result ? "skipped" : "restart",
      filesFixed: 0,
      retried:    true,
    };
  }

  private async handleRollback(opts: {
    runId:     string;
    projectId: number;
  }): Promise<RecoveryOutput> {
    const result   = await undoRun(opts.runId, opts.projectId);
    const success  = "skipped" in result ? false : (result as any).success ?? false;
    const restored = "skipped" in result ? 0 : (result as any).restoredCount ?? 0;

    return {
      mode:       "rollback",
      success,
      action:     "rollback",
      filesFixed: restored,
      retried:    false,
    };
  }

  private async handleAutonomousDebug(opts: {
    runId:     string;
    projectId: number;
    error?:    Error;
  }): Promise<RecoveryOutput> {
    try {
      // handleCrash is the public API entry point for the autonomous debug system
      const session = await handleCrash({
        projectId:    opts.projectId,
        runId:        opts.runId,
        errorMessage: opts.error?.message ?? "Unknown error",
        errorStack:   opts.error?.stack,
        source:       "orchestration-recovery",
      });

      return {
        mode:       "autonomous_debug",
        success:    session?.verdict === "fixed" || session?.verdict === "stable",
        action:     "autonomous-debug",
        filesFixed: session?.fixAttempts?.filter((a: any) => a.applied)?.length ?? 0,
        retried:    true,
      };
    } catch {
      return {
        mode:       "autonomous_debug",
        success:    false,
        action:     "autonomous-debug-failed",
        filesFixed: 0,
        retried:    false,
      };
    }
  }

  // ── Health check ─────────────────────────────────────────────────────────────

  isRecoveryLocked(projectId: number): boolean {
    return isLocked(projectId);
  }
}

export const recoveryBridge = new RecoveryBridge();
