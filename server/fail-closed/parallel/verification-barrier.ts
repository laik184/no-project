/**
 * server/fail-closed/parallel/verification-barrier.ts
 *
 * VerificationBarrier — deterministic wait-all synchronization point.
 *
 * Responsibilities:
 *   ✅ wait-all synchronization via Promise.allSettled
 *   ✅ timeout protection (per-wave configurable)
 *   ✅ failure propagation — first failure stops downstream
 *   ✅ cancellation via AbortSignal
 *   ✅ deterministic barrier release
 *
 * INVARIANT: Barrier NEVER resolves passed:true if any verifier failed.
 * INVARIANT: Timeout always results in passed:false (fail-closed).
 */

import type { StageResult, ClassifiedFailure } from "../contracts/types.ts";
import type { BarrierResult, WaveId }          from "../contracts/parallel-contracts.ts";
import { FailureClassifier }                   from "../audit/failure-classifier.ts";
import { verificationTelemetry }               from "../../telemetry/verification-telemetry.ts";

const DEFAULT_BARRIER_TIMEOUT_MS = 120_000; // 2 minutes per wave
const classifier = new FailureClassifier();

export class VerificationBarrier {
  constructor(
    private readonly runId: string,
    private readonly projectId: number,
    private readonly waveId: WaveId,
    private readonly timeoutMs: number = DEFAULT_BARRIER_TIMEOUT_MS,
  ) {}

  /**
   * Wait for all stage promises to settle.
   * Returns passed:true only if ALL stages pass within timeout.
   * AbortSignal cancellation immediately yields passed:false.
   */
  async wait(
    stagePromises: readonly Promise<StageResult>[],
    signal?: AbortSignal,
  ): Promise<BarrierResult> {
    const started = Date.now();
    verificationTelemetry.barrierWait(this.runId, this.projectId, this.waveId);

    // Cancellation guard — wraps each promise with abort detection
    const guarded = stagePromises.map((p) => this._withAbort(p, signal));

    // Timeout guard — race all guarded promises vs a timeout sentinel
    const timeoutGuard = new Promise<StageResult[]>((_, reject) => {
      const id = setTimeout(() => {
        reject(new Error(`[barrier:${this.waveId}] Wave timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      signal?.addEventListener("abort", () => { clearTimeout(id); reject(new Error("aborted")); });
    });

    let settled: PromiseSettledResult<StageResult>[];

    try {
      // Race: either all verifiers settle or timeout fires
      settled = await Promise.race([
        Promise.allSettled(guarded),
        timeoutGuard.then(() => [] as PromiseSettledResult<StageResult>[]),
      ]);
    } catch (err: any) {
      const latency = Date.now() - started;
      const isTimeout = err.message?.includes("timed out");
      verificationTelemetry.barrierFailed(
        this.runId, this.projectId, this.waveId,
        isTimeout ? "VERIFICATION_TIMEOUT" : "ABORTED",
      );
      const syntheticResult = this._syntheticFail(
        isTimeout ? `Wave ${this.waveId} timed out after ${this.timeoutMs}ms` : "Aborted by signal",
      );
      return {
        passed: false,
        results: [syntheticResult],
        firstFailure: classifier.classify(syntheticResult),
      };
    }

    const results = settled.map((s) =>
      s.status === "fulfilled" ? s.value : this._syntheticFail(String((s as any).reason)),
    );

    const latency = Date.now() - started;
    const failedResult = results.find((r) => !r.passed);

    if (failedResult) {
      const firstFailure = classifier.classify(failedResult);
      verificationTelemetry.barrierFailed(this.runId, this.projectId, this.waveId, firstFailure.class);
      return { passed: false, results, firstFailure };
    }

    verificationTelemetry.barrierReleased(this.runId, this.projectId, this.waveId, latency);
    return { passed: true, results };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _withAbort(p: Promise<StageResult>, signal?: AbortSignal): Promise<StageResult> {
    if (!signal) return p;
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new Error("aborted")); return; }
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      p.then(resolve, reject);
    });
  }

  private _syntheticFail(reason: string): StageResult {
    return {
      stage: "STATIC" as const, // placeholder — caller uses firstFailure.class
      passed: false,
      evidence: [],
      failureReason: reason,
      durationMs: 0,
    };
  }
}
