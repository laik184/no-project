/**
 * specialist-dispatcher.ts
 *
 * Production dispatcher for the parallel specialist swarm.
 * Replaces the stub in specialist-wave-runner.ts.
 *
 * Single responsibility: accept a SpecialistTask, dispatch it to the
 * real LLM-backed executor, return a typed SpecialistResult.
 *
 * Safety contracts:
 * - AbortSignal from CoordinationContext propagates to the executor.
 * - Never throws — all errors captured in SpecialistResult.
 * - Emits specialist.start / specialist.complete / specialist.failed bus events.
 */

import { executeSpecialist }  from "./specialist-executor.ts";
import { bus }                from "../../infrastructure/events/bus.ts";
import type { SpecialistTask, SpecialistResult }
  from "../contracts/specialist.contracts.ts";

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "coordination",
    agentName: "specialist-dispatcher",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export class SpecialistDispatcher {
  /**
   * Dispatch a single specialist task to the real agent executor.
   * Always resolves — failures are encoded in the result envelope.
   */
  async dispatch(
    task:   SpecialistTask,
    signal: AbortSignal,
  ): Promise<SpecialistResult> {
    const { runId, projectId, taskId, domain, goal } = task;

    emit(runId, projectId, "specialist.start", {
      taskId,
      domain,
      goal: goal.slice(0, 120),
    });

    // Short-circuit if the run has already been cancelled
    if (signal.aborted) {
      emit(runId, projectId, "specialist.cancelled", { taskId, domain });
      return {
        taskId, domain,
        success:    false,
        patches:    [],
        artifacts:  {},
        durationMs: 0,
        error:      "cancelled_before_start",
        retryable:  false,
      };
    }

    const result = await executeSpecialist(task, signal);

    if (result.success) {
      emit(runId, projectId, "specialist.complete", {
        taskId, domain,
        durationMs: result.durationMs,
        patchCount: result.patches.length,
      });
    } else {
      emit(runId, projectId, "specialist.failed", {
        taskId, domain,
        durationMs: result.durationMs,
        error:      result.error,
        retryable:  result.retryable,
      });
    }

    return result;
  }
}

export const specialistDispatcher = new SpecialistDispatcher();
