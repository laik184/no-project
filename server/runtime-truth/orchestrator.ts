/**
 * server/runtime-truth/orchestrator.ts
 *
 * VerificationOrchestrator — sequential, deterministic pipeline coordinator.
 * Runs stages in dependency order. Short-circuits on required failures.
 * ONLY this module may authorize a VERIFIED state.
 *
 * Pipeline order (enforced by policy engine):
 *   filesystem → import_graph → typescript → dependencies →
 *   process_health → http_health → preview_behavior
 *
 * Stage implementations live in stage-runners.ts (single responsibility).
 */

import { randomUUID } from "crypto";
import type { VerificationOptions, VerificationReport, StageResult, VerificationStage } from "./types.ts";
import { RuntimeStateMachine }          from "./state-machine.ts";
import { RuntimeStateStore }            from "./state-store.ts";
import { RuntimeEventBus, runtimeEventBus } from "./event-bus.ts";
import { ProcessHealthMonitor }         from "./process-health-monitor.ts";
import { DependencyIntegrityVerifier }  from "./dependency-integrity-verifier.ts";
import { HTTPHealthVerifier }           from "./http-health-verifier.ts";
import { PreviewBehaviorVerifier }      from "./preview-behavior-verifier.ts";
import { RuntimeEvidenceCollector }     from "./evidence-collector.ts";
import { RuntimeChecksumEngine }        from "./checksum-engine.ts";
import { RuntimeSnapshotBuilder }       from "./snapshot-builder.ts";
import { RecoverySignalEmitter }        from "./recovery-signal-emitter.ts";
import { VerificationPolicyEngine }     from "./policy-engine.ts";
import { ImportGraphValidator }         from "../verification/typescript/import-graph-validator.ts";
import { TSConfigResolver }             from "../verification/typescript/tsconfig-resolver.ts";
import {
  type StageRunnerDeps,
  stageSkipped,
  runFilesystem,
  runImportGraph,
  runTypeScript,
  runDependencies,
  runProcessHealth,
  runHttpHealth,
  runPreviewBehavior,
} from "./stage-runners.ts";

export class VerificationOrchestrator {
  private readonly _store: RuntimeStateStore;
  private readonly _bus: RuntimeEventBus;
  private readonly _evidenceCollector: RuntimeEvidenceCollector;
  private readonly _snapshotBuilder: RuntimeSnapshotBuilder;
  private readonly _recoveryEmitter: RecoverySignalEmitter;
  private readonly _policy: VerificationPolicyEngine;
  private readonly _deps: StageRunnerDeps;

  constructor() {
    const machine = new RuntimeStateMachine();
    this._bus = runtimeEventBus;
    this._store = new RuntimeStateStore(machine, this._bus);
    this._evidenceCollector = new RuntimeEvidenceCollector();
    const checksumEngine = new RuntimeChecksumEngine();
    this._snapshotBuilder = new RuntimeSnapshotBuilder(checksumEngine, this._evidenceCollector);
    this._recoveryEmitter = new RecoverySignalEmitter(this._bus);
    this._policy = new VerificationPolicyEngine();
    this._deps = {
      bus: this._bus,
      processMonitor: new ProcessHealthMonitor(),
      depVerifier: new DependencyIntegrityVerifier(),
      httpVerifier: new HTTPHealthVerifier(),
      previewVerifier: new PreviewBehaviorVerifier(),
      checksumEngine,
      importValidator: new ImportGraphValidator(),
      tsconfigResolver: new TSConfigResolver(),
    };
  }

  async run(opts: VerificationOptions): Promise<VerificationReport> {
    const correlationId = opts.correlationId ?? randomUUID();
    const t0 = Date.now();
    const stages: StageResult[] = [];

    this._store.transitionTo("VERIFYING", "Verification started", correlationId);
    this._bus.emit("VERIFICATION_STARTED", correlationId, { projectId: opts.projectId });

    const pipeline = this._policy.buildPipeline(opts);
    let aborted = false;
    let failedStage: VerificationStage | null = null;

    for (const stagePolicy of pipeline) {
      if (opts.signal?.aborted || aborted) {
        stages.push(stageSkipped(stagePolicy.stage));
        continue;
      }

      const stageSignal = opts.signal
        ? AbortSignal.any([opts.signal, AbortSignal.timeout(stagePolicy.timeoutMs)])
        : AbortSignal.timeout(stagePolicy.timeoutMs);

      const result = await this._dispatch(stagePolicy.stage, opts, correlationId, stageSignal);
      stages.push(result);
      this._evidenceCollector.add(result.evidence);

      if (result.status === "FAILED") {
        failedStage = stagePolicy.stage;
        if (this._policy.shouldAbort(stagePolicy, false)) aborted = true;
      }
    }

    const passed = failedStage === null;
    const snapshot = this._snapshotBuilder.build({
      projectId: opts.projectId,
      state: passed ? "VERIFIED" : "FAILED",
      stateVersion: this._store.version + 1,
      stages,
      workspacePath: opts.workspacePath,
    });

    let recoverySignal = null;
    if (passed) {
      this._store.transitionTo("VERIFIED", "All stages passed", correlationId);
      this._recoveryEmitter.resetCount(opts.projectId);
    } else {
      this._store.transitionTo("FAILED", `Stage ${failedStage} failed`, correlationId);
      recoverySignal = this._recoveryEmitter.emit({
        projectId: opts.projectId,
        reason: stages.find((s) => s.status === "FAILED")?.failureReason ?? "Unknown",
        failedStage,
        currentState: "FAILED",
        correlationId,
      });
    }

    this._bus.emit("VERIFICATION_COMPLETED", correlationId, {
      passed, failedStage, durationMs: Date.now() - t0,
    });

    return Object.freeze({
      correlationId,
      projectId: opts.projectId,
      passed,
      state: this._store.state,
      stages: Object.freeze(stages),
      snapshot,
      recoverySignal,
      durationMs: Date.now() - t0,
      timestamp: Date.now(),
    });
  }

  private async _dispatch(
    stage: VerificationStage,
    opts: VerificationOptions,
    cid: string,
    signal: AbortSignal
  ): Promise<StageResult> {
    try {
      switch (stage) {
        case "filesystem":       return await runFilesystem(opts, this._deps);
        case "import_graph":     return await runImportGraph(opts, this._deps, cid);
        case "typescript":       return await runTypeScript(opts, this._deps, cid, signal);
        case "dependencies":     return await runDependencies(opts, this._deps, cid);
        case "process_health":   return await runProcessHealth(opts, this._deps, cid);
        case "http_health":      return await runHttpHealth(opts, this._deps, cid, signal);
        case "preview_behavior": return await runPreviewBehavior(opts, this._deps, cid, signal);
      }
    } catch (err) {
      return Object.freeze({
        stage, status: "FAILED" as const,
        durationMs: 0, detail: String(err),
        evidence: [], failureReason: String(err),
      });
    }
  }

  get stateStore(): RuntimeStateStore { return this._store; }
  get evidenceBus(): RuntimeEventBus  { return this._bus;   }
}
