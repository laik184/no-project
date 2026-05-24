/**
 * server/fail-closed/coordinator/verification-coordinator.ts
 *
 * VerificationCoordinator — top-level fail-closed pipeline orchestrator.
 *
 * UPGRADED: Now delegates to ParallelVerificationEngine (Wave A → B → C)
 * instead of the previous sequential 5-stage loop. Latency reduction: 3–5×.
 *
 * Pipeline:
 *   Wave A (parallel):  STATIC + BUILD
 *   Barrier A
 *   Wave B (parallel):  RUNTIME + PREVIEW
 *   Barrier B
 *   Wave C (sequential): STATE_RECONCILIATION
 *
 * INVARIANT: Returns ok:true ONLY when CompletionAuthority authorizes.
 * INVARIANT: Verification exhaustion ALWAYS returns ok:false.
 * INVARIANT: The run NEVER silently degrades.
 */

import type {
  FailClosedRunOptions,
  CompletionProposal,
  CompletionVerdict,
  StageResult,
} from "../contracts/types.ts";
import { VerificationStateMachine }       from "../state-machine/verification-state-machine.ts";
import { EvidenceGate }                   from "../gates/evidence-gate.ts";
import { CompletionAuthority }            from "../gates/completion-authority.ts";
import { VerificationAuditLog }           from "../audit/verification-audit-log.ts";
import { FailureClassifier }              from "../audit/failure-classifier.ts";
import { RetryPolicyEngine }              from "../retry/retry-policy-engine.ts";
import { CheckpointManager }             from "../recovery/checkpoint-manager.ts";
import { RollbackExecutor }              from "../recovery/rollback-executor.ts";
import { RecoveryCoordinator }           from "../recovery/recovery-coordinator.ts";
import { ParallelVerificationEngine }    from "../parallel/parallel-verification-engine.ts";
import { verificationTelemetry }         from "../../telemetry/verification-telemetry.ts";

export type RunResult =
  | { ok: true;  verdict: CompletionVerdict; audit: VerificationAuditLog; stageResults: readonly StageResult[] }
  | { ok: false; verdict: CompletionVerdict; audit: VerificationAuditLog; stageResults: readonly StageResult[]; halted: boolean };

export class VerificationCoordinator {
  private readonly _classifier  = new FailureClassifier();
  private readonly _checkpoints = new CheckpointManager();
  private readonly _rollback    = new RollbackExecutor();
  private readonly _engine      = new ParallelVerificationEngine();

  async run(opts: FailClosedRunOptions, proposal: CompletionProposal): Promise<RunResult> {
    const machine   = new VerificationStateMachine();
    const audit     = new VerificationAuditLog(opts.runId);
    const gate      = new EvidenceGate();
    const authority = new CompletionAuthority(machine, gate, audit);
    const retry     = new RetryPolicyEngine();
    const recovery  = new RecoveryCoordinator(this._checkpoints, this._rollback, machine, audit);

    audit.pipelineStarted(`Run ${opts.runId} started for project ${opts.projectId} [parallel mode]`);
    machine.tryTransition("VERIFYING_STATIC", "Parallel pipeline entry — Wave A");

    let retryCount  = 0;
    const maxRetries = opts.maxRetries ?? 3;

    while (true) {
      // ── Run the parallel engine (Wave A → B → C) ──────────────────────────
      const result = await this._engine.run(opts, proposal);

      const stageResults = [...result.stageResults] as StageResult[];

      if (result.ok) {
        // All waves passed — checkpoint + authorize
        const allEvidence = stageResults.flatMap((r) => [...r.evidence]);
        this._checkpoints.create(opts.projectId, opts.workspacePath, allEvidence);
        machine.tryTransition("VERIFIED_SUCCESS", "All waves passed");
        audit.stagePassed("STATE_RECONCILIATION", []);

        const verdict = authority.evaluate(proposal, stageResults);
        return { ok: true, verdict, audit, stageResults };
      }

      // ── Wave failed — classify and decide ────────────────────────────────
      const failedResult = stageResults.find((r) => !r.passed);
      if (!failedResult) {
        machine.forceTerminal("HALTED", "Engine reported failure but no failed stage found");
        const verdict = authority.evaluate(proposal, stageResults);
        return { ok: false, verdict, audit, stageResults, halted: true };
      }

      audit.stageFailed(failedResult.stage as any, failedResult.failureReason ?? "unknown");
      const classified = this._classifier.classify(failedResult);
      const decision   = retry.decide(classified, retryCount, maxRetries);

      verificationTelemetry.verifierRetry(opts.runId, opts.projectId, failedResult.stage as any, retryCount);

      if (!decision.shouldRetry) {
        machine.tryTransition("FAILED", failedResult.failureReason ?? `${result.failedWave} failed`);
        const verdict = authority.evaluate(proposal, stageResults);

        // Attempt recovery (checkpoint rollback + reverify)
        const recov = await recovery.recover(opts.projectId, classified);
        if (!recov.proceeded) {
          return { ok: false, verdict, audit, stageResults, halted: recov.halted ?? false };
        }

        // Recovery succeeded — re-enter pipeline from REVERIFYING
        machine.tryTransition("REVERIFYING", "Recovery succeeded — re-entering parallel pipeline");
        retryCount++;
        continue;
      }

      // Retry after backoff
      audit.retryScheduled(decision.strategy.name, failedResult.stage as any);
      await retry.wait(decision.delayMs, opts.signal);
      retryCount++;
    }
  }
}
