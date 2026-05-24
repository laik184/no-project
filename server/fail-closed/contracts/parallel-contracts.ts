/**
 * server/fail-closed/contracts/parallel-contracts.ts
 *
 * Typed contracts for the parallel fail-closed verification system.
 * Pure types only — no logic, no imports from implementation modules.
 *
 * INVARIANT: Wave execution is always ordered: A → B → C.
 * INVARIANT: Barrier release requires ALL verifiers in the wave to pass.
 * INVARIANT: Wave C (RECONCILE) is always sequential — never parallelized.
 */

import type { StageResult, VerificationStage, ClassifiedFailure } from "./types.ts";

// ── Wave identity ─────────────────────────────────────────────────────────────

export type WaveId = "WAVE_A" | "WAVE_B" | "WAVE_C";

export type WaveDefinition = {
  readonly id: WaveId;
  readonly stages: readonly VerificationStage[];
  readonly parallel: boolean;
  readonly label: string;
};

export const WAVE_DEFINITIONS: readonly WaveDefinition[] = [
  { id: "WAVE_A", stages: ["STATIC", "BUILD"],             parallel: true,  label: "Static + Build" },
  { id: "WAVE_B", stages: ["RUNTIME", "PREVIEW"],          parallel: true,  label: "Runtime + Preview" },
  { id: "WAVE_C", stages: ["STATE_RECONCILIATION"],        parallel: false, label: "Reconcile (sequential)" },
] as const;

// ── Verifier interface ────────────────────────────────────────────────────────

export interface IParallelVerifier {
  readonly stage: VerificationStage;
  run(signal?: AbortSignal): Promise<StageResult>;
}

// ── Barrier ───────────────────────────────────────────────────────────────────

export type BarrierResult =
  | { passed: true;  results: readonly StageResult[] }
  | { passed: false; results: readonly StageResult[]; firstFailure: ClassifiedFailure };

// ── Wave result ───────────────────────────────────────────────────────────────

export type WaveResult = {
  readonly waveId: WaveId;
  readonly passed: boolean;
  readonly results: readonly StageResult[];
  readonly durationMs: number;
  readonly firstFailure?: ClassifiedFailure;
};

// ── Parallel engine options ───────────────────────────────────────────────────

export type ParallelEngineOptions = {
  readonly runId: string;
  readonly projectId: number;
  readonly workspacePath: string;
  readonly port?: number;
  readonly previewUrl?: string;
  readonly signal?: AbortSignal;
  readonly skipStages?: readonly VerificationStage[];
  readonly waveTimeoutMs?: number;
};

// ── Parallel engine result ────────────────────────────────────────────────────

export type ParallelEngineResult = {
  readonly passed: boolean;
  readonly stageResults: readonly StageResult[];
  readonly waveResults: readonly WaveResult[];
  readonly totalDurationMs: number;
  readonly failedWave?: WaveId;
  readonly firstFailure?: ClassifiedFailure;
};

// ── Telemetry events ──────────────────────────────────────────────────────────

export type VerificationTelemetryEvent =
  | "verification.started"
  | "verification.completed"
  | "verification.failed"
  | "verification.retry"
  | "verification.timeout"
  | "verification.barrier.wait"
  | "verification.barrier.released"
  | "verification.barrier.failed"
  | "verification.wave.started"
  | "verification.wave.completed"
  | "verification.wave.failed"
  | "verification.parallel.dispatch"
  | "verification.parallel.completed"
  | "verification.runtime.failed"
  | "verification.preview.failed";

export type VerificationTelemetryPayload = {
  readonly runId: string;
  readonly projectId: number;
  readonly phase?: string;
  readonly verifier?: VerificationStage;
  readonly waveId?: WaveId;
  readonly latencyMs?: number;
  readonly retryCount?: number;
  readonly correlationId?: string;
  readonly subsystem?: string;
  readonly errorClass?: string;
  readonly detail?: string;
};
