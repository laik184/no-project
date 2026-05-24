/**
 * server/fail-closed/parallel/verification-wave-runner.ts
 *
 * VerificationWaveRunner — executes one wave of verifiers (parallel or sequential).
 *
 * Responsibilities:
 *   ✅ dispatch parallel verifier groups via Promise.allSettled
 *   ✅ aggregate results from all verifiers in the wave
 *   ✅ attach per-verifier telemetry (start / complete / fail / timeout)
 *   ✅ deterministic ordering of results
 *
 * INVARIANT: Sequential waves (Wave C) run one verifier at a time.
 * INVARIANT: Parallel waves (Wave A, B) dispatch ALL verifiers simultaneously.
 * INVARIANT: Never swallows errors — all exceptions become failed StageResults.
 */

import type { StageResult }                    from "../contracts/types.ts";
import type {
  IParallelVerifier,
  WaveDefinition,
  WaveResult,
}                                              from "../contracts/parallel-contracts.ts";
import { VerificationBarrier }                 from "./verification-barrier.ts";
import { verificationTelemetry }               from "../../telemetry/verification-telemetry.ts";

const VERIFIER_TIMEOUT_MS = 90_000; // 90s per individual verifier

export class VerificationWaveRunner {
  constructor(
    private readonly runId: string,
    private readonly projectId: number,
  ) {}

  /**
   * Run a full wave. Parallel waves dispatch all verifiers simultaneously.
   * Sequential waves run each verifier one-at-a-time and short-circuit on failure.
   */
  async run(
    wave: WaveDefinition,
    verifiers: readonly IParallelVerifier[],
    signal?: AbortSignal,
    barrierTimeoutMs?: number,
  ): Promise<WaveResult> {
    const started = Date.now();
    verificationTelemetry.waveStarted(this.runId, this.projectId, wave.id);

    let results: readonly StageResult[];

    if (wave.parallel) {
      results = await this._runParallel(wave, verifiers, signal, barrierTimeoutMs);
    } else {
      results = await this._runSequential(wave, verifiers, signal);
    }

    const durationMs  = Date.now() - started;
    const firstFailed = results.find((r) => !r.passed);
    const passed      = !firstFailed;

    if (passed) {
      verificationTelemetry.waveCompleted(this.runId, this.projectId, wave.id, durationMs);
    } else {
      verificationTelemetry.waveFailed(
        this.runId, this.projectId, wave.id,
        "STAGE_FAILURE",
        firstFailed?.failureReason ?? "unknown",
      );
    }

    return { waveId: wave.id, passed, results, durationMs };
  }

  // ── Parallel execution ──────────────────────────────────────────────────────

  private async _runParallel(
    wave: WaveDefinition,
    verifiers: readonly IParallelVerifier[],
    signal?: AbortSignal,
    barrierTimeoutMs?: number,
  ): Promise<readonly StageResult[]> {
    const stages = verifiers.map((v) => v.stage);
    verificationTelemetry.parallelDispatch(this.runId, this.projectId, wave.id, [...stages]);

    // Wrap each verifier with a per-verifier timeout
    const promises = verifiers.map((v) => this._withTimeout(v, signal));

    const barrier = new VerificationBarrier(
      this.runId, this.projectId, wave.id, barrierTimeoutMs,
    );
    const barrierResult = await barrier.wait(promises, signal);

    const latency = barrierResult.results.reduce((acc, r) => acc + r.durationMs, 0);
    verificationTelemetry.parallelCompleted(this.runId, this.projectId, wave.id, latency);

    return barrierResult.results;
  }

  // ── Sequential execution (Wave C only) ─────────────────────────────────────

  private async _runSequential(
    wave: WaveDefinition,
    verifiers: readonly IParallelVerifier[],
    signal?: AbortSignal,
  ): Promise<readonly StageResult[]> {
    const results: StageResult[] = [];
    for (const verifier of verifiers) {
      const result = await this._withTimeout(verifier, signal);
      results.push(result);
      if (!result.passed) break; // short-circuit on first failure
    }
    return results;
  }

  // ── Per-verifier timeout wrapper ────────────────────────────────────────────

  private async _withTimeout(
    verifier: IParallelVerifier,
    signal?: AbortSignal,
  ): Promise<StageResult> {
    const started = Date.now();

    const timeoutPromise = new Promise<StageResult>((_, reject) => {
      const id = setTimeout(() => reject(new Error(`timeout:${verifier.stage}`)), VERIFIER_TIMEOUT_MS);
      signal?.addEventListener("abort", () => { clearTimeout(id); reject(new Error(`aborted:${verifier.stage}`)); });
    });

    try {
      const result = await Promise.race([verifier.run(signal), timeoutPromise]);
      return result;
    } catch (err: any) {
      const latency = Date.now() - started;
      const isTimeout = String(err.message).startsWith("timeout:");

      if (isTimeout) {
        verificationTelemetry.verifierTimeout(this.runId, this.projectId, verifier.stage, latency);
      }

      return {
        stage: verifier.stage,
        passed: false,
        evidence: [],
        failureReason: isTimeout ? `Verifier ${verifier.stage} timed out after ${VERIFIER_TIMEOUT_MS}ms` : String(err.message),
        durationMs: latency,
      };
    }
  }
}
