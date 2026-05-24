/**
 * server/fail-closed/parallel/parallel-verification-engine.ts
 *
 * ParallelVerificationEngine — transforms the sequential 5-stage pipeline into:
 *
 *   Wave A (PARALLEL): [STATIC + BUILD]
 *       ↓ VerificationBarrier (wait-all + timeout + abort)
 *   Wave B (PARALLEL): [RUNTIME + PREVIEW]
 *       ↓ VerificationBarrier (wait-all + timeout + abort)
 *   Wave C (SEQUENTIAL): [STATE_RECONCILIATION] — deterministic final gate
 *
 * Target reduction: 3–5× latency improvement over sequential pipeline.
 *
 * INVARIANT: Wave B never starts if Wave A barrier fails.
 * INVARIANT: Wave C never starts if Wave B barrier fails.
 * INVARIANT: Returns ok:true ONLY when all waves pass.
 * INVARIANT: Any failure aborts remaining waves via AbortController.
 */

import { bus }                            from "../../infrastructure/events/bus.ts";
import { StaticVerifier }                 from "../verifiers/static-verifier.ts";
import { BuildVerifier }                  from "../verifiers/build-verifier.ts";
import { RuntimeVerifier }                from "../verifiers/runtime-verifier.ts";
import { PreviewVerifier }                from "../verifiers/preview-verifier.ts";
import { StateReconciler }                from "../verifiers/state-reconciler.ts";
import { VerificationWaveRunner }         from "./verification-wave-runner.ts";
import { VerificationRecoveryBridge }     from "../recovery/verification-recovery-bridge.ts";
import { FailureClassifier }              from "../audit/failure-classifier.ts";
import { verificationTelemetry }          from "../../telemetry/verification-telemetry.ts";
import { WAVE_DEFINITIONS }               from "../contracts/parallel-contracts.ts";
import type {
  FailClosedRunOptions,
  CompletionProposal,
  StageResult,
} from "../contracts/types.ts";
import type { IParallelVerifier }         from "../contracts/parallel-contracts.ts";

// ── Public result type ────────────────────────────────────────────────────────

export interface ParallelVerificationResult {
  ok:           boolean;
  stageResults: StageResult[];
  waveResults:  WaveResult[];
  durationMs:   number;
  failedStage?: string;
  failedWave?:  "A" | "B" | "C";
}

interface WaveResult {
  wave:      "A" | "B" | "C";
  passed:    boolean;
  durationMs: number;
  stages:    string[];
}

// ── IParallelVerifier adapters ────────────────────────────────────────────────

class StaticAdapter implements IParallelVerifier {
  readonly stage = "STATIC" as const;
  constructor(private readonly path: string) {}
  run(signal?: AbortSignal) { return new StaticVerifier().verify(this.path, signal); }
}

class BuildAdapter implements IParallelVerifier {
  readonly stage = "BUILD" as const;
  constructor(private readonly path: string) {}
  run(signal?: AbortSignal) { return new BuildVerifier().verify(this.path, { signal, skipCache: true }); }
}

class RuntimeAdapter implements IParallelVerifier {
  readonly stage = "RUNTIME" as const;
  constructor(private readonly projectId: number, private readonly port?: number, private readonly previewUrl?: string) {}
  run(signal?: AbortSignal) { return new RuntimeVerifier().verify(this.projectId, { port: this.port, previewUrl: this.previewUrl, signal }); }
}

class PreviewAdapter implements IParallelVerifier {
  readonly stage = "PREVIEW" as const;
  constructor(private readonly port?: number, private readonly previewUrl?: string) {}
  run(signal?: AbortSignal) { return new PreviewVerifier().verify({ port: this.port, previewUrl: this.previewUrl, signal }); }
}

class ReconcileAdapter implements IParallelVerifier {
  readonly stage = "STATE_RECONCILIATION" as const;
  constructor(private readonly proposal: CompletionProposal, private readonly prior: StageResult[]) {}
  run(): Promise<StageResult> {
    const evidence = this.prior.flatMap((r) => [...r.evidence]);
    return Promise.resolve(new StateReconciler().verify(this.proposal, evidence));
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────

const classifier = new FailureClassifier();

export class ParallelVerificationEngine {
  async run(
    opts:     FailClosedRunOptions,
    proposal: CompletionProposal,
  ): Promise<ParallelVerificationResult> {
    const pipelineStart = Date.now();
    const { runId, projectId } = opts;
    const skip       = new Set(opts.skipStages ?? []);
    const controller = new AbortController();
    const signal     = opts.signal ?? controller.signal;
    const runner     = new VerificationWaveRunner(runId, projectId);
    const bridge     = new VerificationRecoveryBridge(runId, projectId);
    const allStages: StageResult[] = [];
    const allWaves:  WaveResult[]  = [];

    verificationTelemetry.pipelineStarted(runId, projectId);
    bus.emit("agent.event" as any, {
      runId, projectId, phase: "verification",
      eventType: "parallel.pipeline.started",
      payload: { waves: 3, mode: "A(parallel)→B(parallel)→C(sequential)" },
    });

    // ── Wave A: STATIC + BUILD (parallel) ─────────────────────────────────────
    const waveADef    = WAVE_DEFINITIONS.find((w) => w.id === "WAVE_A")!;
    const waveAVers: IParallelVerifier[] = [];
    if (!skip.has("STATIC")) waveAVers.push(new StaticAdapter(opts.workspacePath));
    if (!skip.has("BUILD"))  waveAVers.push(new BuildAdapter(opts.workspacePath));

    if (waveAVers.length > 0) {
      const waveAOut = await runner.run(waveADef, waveAVers, signal, opts.timeoutMs);
      allStages.push(...waveAOut.results);
      allWaves.push({ wave: "A", passed: waveAOut.passed, durationMs: waveAOut.durationMs, stages: ["STATIC", "BUILD"] });

      if (!waveAOut.passed) {
        controller.abort();
        const failed     = waveAOut.results.find((r) => !r.passed)!;
        const failure    = classifier.classify(failed);
        await bridge.recover(waveADef.id, failure);
        verificationTelemetry.pipelineFailed(runId, projectId, failure.class, failure.detail);
        return this._fail("A", failed.stage, allStages, allWaves, pipelineStart);
      }
    }

    // ── Wave B: RUNTIME + PREVIEW (parallel) ──────────────────────────────────
    const waveBDef   = WAVE_DEFINITIONS.find((w) => w.id === "WAVE_B")!;
    const waveBVers: IParallelVerifier[] = [];
    if (!skip.has("RUNTIME"))  waveBVers.push(new RuntimeAdapter(projectId, opts.port, opts.previewUrl));
    if (!skip.has("PREVIEW"))  waveBVers.push(new PreviewAdapter(opts.port, opts.previewUrl));

    if (waveBVers.length > 0) {
      const waveBOut = await runner.run(waveBDef, waveBVers, signal, opts.timeoutMs);
      allStages.push(...waveBOut.results);
      allWaves.push({ wave: "B", passed: waveBOut.passed, durationMs: waveBOut.durationMs, stages: ["RUNTIME", "PREVIEW"] });

      if (!waveBOut.passed) {
        controller.abort();
        const failed     = waveBOut.results.find((r) => !r.passed)!;
        const failure    = classifier.classify(failed);
        await bridge.recover(waveBDef.id, failure);
        verificationTelemetry.pipelineFailed(runId, projectId, failure.class, failure.detail);
        return this._fail("B", failed.stage, allStages, allWaves, pipelineStart);
      }
    }

    // ── Wave C: STATE_RECONCILIATION (sequential — deterministic final gate) ───
    const waveCDef = WAVE_DEFINITIONS.find((w) => w.id === "WAVE_C")!;
    if (!skip.has("STATE_RECONCILIATION")) {
      const waveCOut = await runner.run(waveCDef, [new ReconcileAdapter(proposal, allStages)], signal, opts.timeoutMs);
      allStages.push(...waveCOut.results);
      allWaves.push({ wave: "C", passed: waveCOut.passed, durationMs: waveCOut.durationMs, stages: ["STATE_RECONCILIATION"] });

      if (!waveCOut.passed) {
        const failed  = waveCOut.results.find((r) => !r.passed)!;
        const failure = classifier.classify(failed);
        verificationTelemetry.pipelineFailed(runId, projectId, failure.class, failure.detail);
        return this._fail("C", "STATE_RECONCILIATION", allStages, allWaves, pipelineStart);
      }
    }

    const durationMs = Date.now() - pipelineStart;
    verificationTelemetry.pipelineCompleted(runId, projectId, durationMs);
    bus.emit("agent.event" as any, {
      runId, projectId, phase: "verification",
      eventType: "parallel.pipeline.passed",
      payload: { durationMs, waveCount: allWaves.length },
    });

    return { ok: true, stageResults: allStages, waveResults: allWaves, durationMs };
  }

  private _fail(
    failedWave: "A" | "B" | "C",
    failedStage: string,
    stageResults: StageResult[],
    waveResults: WaveResult[],
    start: number,
  ): ParallelVerificationResult {
    return { ok: false, stageResults, waveResults, durationMs: Date.now() - start, failedWave, failedStage };
  }
}

export const parallelVerificationEngine = new ParallelVerificationEngine();
