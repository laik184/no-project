/**
 * recovery-orchestrator.ts
 *
 * Orchestrates the full recovery pipeline:
 *   Detect → Classify → Strategy → Execute → Verify → Learn
 *
 * Central coordinator for all recovery scenarios within orchestration.
 */

import { recoveryBridge }               from "../agents/recovery-bridge.ts";
import { verificationBridge }           from "../agents/verification-bridge.ts";
import { memoryBridge }                 from "../agents/memory-bridge.ts";
import { selectRecoveryStrategy }       from "../core/orchestration-recovery.ts";
import { emitPhaseTransition }          from "../core/orchestration-events.ts";
import { captureCheckpoint }            from "../core/orchestration-replay.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }             from "../telemetry/orchestration-metrics.ts";
import { bus }                          from "../../infrastructure/events/bus.ts";
import type { OrchestrationPhase }      from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecoveryPipelineInput {
  runId:      string;
  projectId:  number;
  error:      Error;
  phase:      OrchestrationPhase;
  goal?:      string;
  port?:      number;
}

export interface RecoveryPipelineResult {
  success:        boolean;
  strategy:       string;
  action:         string;
  filesRestored:  number;
  verified:       boolean;
  durationMs:     number;
  shouldRetry:    boolean;
  resumePhase?:   OrchestrationPhase;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

class RecoveryOrchestrator {
  // ── Active recovery locks ─────────────────────────────────────────────────

  private _active = new Set<string>(); // projectId as string

  // ── Main recovery pipeline ────────────────────────────────────────────────

  async runRecoveryPipeline(
    input: RecoveryPipelineInput,
  ): Promise<RecoveryPipelineResult> {
    const { runId, projectId, error, phase } = input;
    const key    = String(projectId);
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "recovery.pipeline", {
      projectId: String(projectId),
      phase,
      error:     error.message.slice(0, 80),
    });

    // Prevent concurrent recovery on same project
    if (this._active.has(key)) {
      console.warn(`[recovery-orchestrator] Recovery already active for project ${projectId} — skipping`);
      return {
        success: false, strategy: "circuit_break", action: "already_recovering",
        filesRestored: 0, verified: false, durationMs: 0, shouldRetry: false,
      };
    }
    this._active.add(key);

    try {
      // 1. Phase: DETECT — emit to bus
      emitPhaseTransition({ runId, projectId, phase: "heal", outcome: "success", durationMs: 0, notes: `Recovering from ${phase}: ${error.message.slice(0, 60)}` });
      bus.emit("debug.lifecycle", { projectId, sessionId: runId, eventType: "recovery.started", payload: { error: error.message, phase }, ts: Date.now() });

      // 2. Phase: CLASSIFY
      const decision = selectRecoveryStrategy(runId, error, phase);
      console.log(`[recovery-orchestrator] Strategy=${decision.strategy} confidence=${decision.confidence}`);
      incrementCounter(`recovery.strategy.${decision.strategy}`, { projectId: key });

      // 3. Phase: EXECUTE RECOVERY
      const recoveryResult = await recoveryBridge.recover({
        runId,
        projectId,
        mode:   this.toRecoveryMode(decision.strategy),
        error,
        reason: decision.reason,
      });

      // 4. Phase: VERIFY (if recovery succeeded)
      let verified = false;
      if (recoveryResult.success && input.port) {
        const vResult = await verificationBridge.verifyRuntimeReady({ runId, projectId });
        verified = vResult.success;
      }

      // 5. Phase: LEARN
      if (input.goal) {
        await memoryBridge.saveRunSummary({
          runId, projectId,
          goal:       input.goal,
          outcome:    recoveryResult.success ? "partial" : "failure",
          durationMs: Date.now() - t0,
          score:      recoveryResult.success ? 0.4 : 0,
          notes:      `Recovery via ${decision.strategy}: ${recoveryResult.data?.action ?? "unknown"}`,
        });
      }

      // 6. Checkpoint after successful recovery
      if (recoveryResult.success) {
        captureCheckpoint(runId, projectId, "heal");
      }

      const result: RecoveryPipelineResult = {
        success:       recoveryResult.success,
        strategy:      decision.strategy,
        action:        recoveryResult.data?.action ?? "unknown",
        filesRestored: recoveryResult.data?.filesFixed ?? 0,
        verified,
        durationMs:    Date.now() - t0,
        shouldRetry:   recoveryResult.success,
        resumePhase:   recoveryResult.success ? "execute" : undefined,
      };

      bus.emit("debug.lifecycle", {
        projectId,
        sessionId: runId,
        eventType: `recovery.${result.success ? "succeeded" : "failed"}`,
        payload:   result,
        ts:        Date.now(),
      });

      incrementCounter(
        result.success ? "recovery.pipeline.succeeded" : "recovery.pipeline.failed",
        { projectId: key, strategy: decision.strategy },
      );

      recordSpanEnd(spanId, result.success ? "ok" : "error");
      return result;

    } finally {
      this._active.delete(key);
    }
  }

  // ── Bus integration: auto-trigger on process crash ────────────────────────

  init(): void {
    bus.subscribe("agent.event", async (e) => {
      if (e.phase !== "runtime" || e.eventType !== "process.crashed") return;
      if (!e.projectId || !e.runId) return;

      const err = new Error(String((e.payload as any)?.error ?? "Process crashed"));
      console.log(`[recovery-orchestrator] Auto-recovery triggered for project ${e.projectId}`);

      await this.runRecoveryPipeline({
        runId:     e.runId,
        projectId: e.projectId,
        error:     err,
        phase:     "execute",
      }).catch(err2 => {
        console.error(`[recovery-orchestrator] Auto-recovery failed: ${err2}`);
      });
    });

    console.log("[recovery-orchestrator] Auto-recovery bus integration active.");
  }

  private toRecoveryMode(strategy: string): "crash" | "rollback" | "autonomous_debug" {
    switch (strategy) {
      case "rollback":            return "rollback";
      case "checkpoint_restore":  return "rollback";
      case "retry":               return "crash";
      default:                    return "autonomous_debug";
    }
  }
}

export const recoveryOrchestrator = new RecoveryOrchestrator();
