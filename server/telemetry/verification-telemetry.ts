/**
 * server/telemetry/verification-telemetry.ts
 *
 * VerificationTelemetry — emits structured telemetry for all parallel
 * verification events. Single responsibility: event emission only.
 *
 * Coverage:
 *   ✅ wave timing        ✅ verifier timing
 *   ✅ retry metrics      ✅ timeout metrics
 *   ✅ parallel throughput ✅ failure classification
 *   ✅ barrier sync events
 */

import { bus }           from "../infrastructure/events/bus.ts";
import { record }        from "./telemetry-collector.ts";
import type {
  VerificationTelemetryEvent,
  VerificationTelemetryPayload,
  WaveId,
} from "../fail-closed/contracts/parallel-contracts.ts";
import type { VerificationStage } from "../fail-closed/contracts/types.ts";

// ── Internal emit helper ──────────────────────────────────────────────────────

function emit(
  event: VerificationTelemetryEvent,
  payload: VerificationTelemetryPayload,
): void {
  const { runId, projectId, phase, ...rest } = payload;

  // Persist to telemetry store
  record("agent.event" as any, runId, projectId, { event, ...rest }, ["verification"], phase);

  // Broadcast on bus so SSE streams pick it up in real-time
  bus.emit("agent.event" as any, {
    runId,
    projectId,
    eventType: event,
    phase: phase ?? "verification",
    payload: { event, ...rest },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const verificationTelemetry = {
  pipelineStarted(runId: string, projectId: number): void {
    emit("verification.started", { runId, projectId, phase: "pipeline", detail: "Parallel pipeline started" });
  },

  pipelineCompleted(runId: string, projectId: number, latencyMs: number): void {
    emit("verification.completed", { runId, projectId, latencyMs, detail: "All waves passed" });
  },

  pipelineFailed(runId: string, projectId: number, errorClass: string, detail: string): void {
    emit("verification.failed", { runId, projectId, errorClass, detail, subsystem: "pipeline" });
  },

  waveStarted(runId: string, projectId: number, waveId: WaveId): void {
    emit("verification.wave.started", { runId, projectId, waveId, phase: waveId });
  },

  waveCompleted(runId: string, projectId: number, waveId: WaveId, latencyMs: number): void {
    emit("verification.wave.completed", { runId, projectId, waveId, latencyMs, phase: waveId });
  },

  waveFailed(runId: string, projectId: number, waveId: WaveId, errorClass: string, detail: string): void {
    emit("verification.wave.failed", { runId, projectId, waveId, errorClass, detail, phase: waveId });
  },

  barrierWait(runId: string, projectId: number, waveId: WaveId): void {
    emit("verification.barrier.wait", { runId, projectId, waveId, subsystem: "barrier" });
  },

  barrierReleased(runId: string, projectId: number, waveId: WaveId, latencyMs: number): void {
    emit("verification.barrier.released", { runId, projectId, waveId, latencyMs, subsystem: "barrier" });
  },

  barrierFailed(runId: string, projectId: number, waveId: WaveId, errorClass: string): void {
    emit("verification.barrier.failed", { runId, projectId, waveId, errorClass, subsystem: "barrier" });
  },

  parallelDispatch(runId: string, projectId: number, waveId: WaveId, verifiers: VerificationStage[]): void {
    emit("verification.parallel.dispatch", {
      runId, projectId, waveId,
      detail: `Dispatching [${verifiers.join(", ")}] in parallel`,
    });
  },

  parallelCompleted(runId: string, projectId: number, waveId: WaveId, latencyMs: number): void {
    emit("verification.parallel.completed", { runId, projectId, waveId, latencyMs });
  },

  verifierTimeout(runId: string, projectId: number, verifier: VerificationStage, latencyMs: number): void {
    emit("verification.timeout", { runId, projectId, verifier, latencyMs, errorClass: "VERIFICATION_TIMEOUT" });
  },

  verifierRetry(runId: string, projectId: number, verifier: VerificationStage, retryCount: number): void {
    emit("verification.retry", { runId, projectId, verifier, retryCount });
  },

  runtimeFailed(runId: string, projectId: number, detail: string): void {
    emit("verification.runtime.failed", { runId, projectId, verifier: "RUNTIME", errorClass: "PROCESS_FAILURE", detail });
  },

  previewFailed(runId: string, projectId: number, detail: string): void {
    emit("verification.preview.failed", { runId, projectId, verifier: "PREVIEW", errorClass: "PREVIEW_FAILURE", detail });
  },
};
