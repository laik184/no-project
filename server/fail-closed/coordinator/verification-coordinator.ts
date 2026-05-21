/**
 * server/fail-closed/coordinator/verification-coordinator.ts
 *
 * VerificationCoordinator — top-level fail-closed pipeline orchestrator.
 *
 * Pipeline:
 *   IDLE → STATIC → BUILD → RUNTIME → PREVIEW → RECONCILE → VERIFIED_SUCCESS
 *   Any stage failure → FAILED → (recovery?) → HALT or REVERIFY
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
import { VerificationStateMachine }  from "../state-machine/verification-state-machine.ts";
import { EvidenceGate }              from "../gates/evidence-gate.ts";
import { CompletionAuthority }       from "../gates/completion-authority.ts";
import { VerificationAuditLog }      from "../audit/verification-audit-log.ts";
import { FailureClassifier }         from "../audit/failure-classifier.ts";
import { StaticVerifier }            from "../verifiers/static-verifier.ts";
import { BuildVerifier }             from "../verifiers/build-verifier.ts";
import { RuntimeVerifier }           from "../verifiers/runtime-verifier.ts";
import { PreviewVerifier }           from "../verifiers/preview-verifier.ts";
import { StateReconciler }           from "../verifiers/state-reconciler.ts";
import { RetryPolicyEngine }         from "../retry/retry-policy-engine.ts";
import { CheckpointManager }         from "../recovery/checkpoint-manager.ts";
import { RollbackExecutor }          from "../recovery/rollback-executor.ts";
import { RecoveryCoordinator }       from "../recovery/recovery-coordinator.ts";

export type RunResult =
  | { ok: true;  verdict: CompletionVerdict; audit: VerificationAuditLog; stageResults: readonly StageResult[] }
  | { ok: false; verdict: CompletionVerdict; audit: VerificationAuditLog; stageResults: readonly StageResult[]; halted: boolean };

export class VerificationCoordinator {
  private readonly _classifier = new FailureClassifier();
  private readonly _checkpoints = new CheckpointManager();
  private readonly _rollback    = new RollbackExecutor();

  async run(opts: FailClosedRunOptions, proposal: CompletionProposal): Promise<RunResult> {
    const machine  = new VerificationStateMachine();
    const audit    = new VerificationAuditLog(opts.runId);
    const gate     = new EvidenceGate();
    const authority = new CompletionAuthority(machine, gate, audit);
    const retry    = new RetryPolicyEngine();
    const recovery = new RecoveryCoordinator(this._checkpoints, this._rollback, machine, audit);

    audit.pipelineStarted(`Run ${opts.runId} started for project ${opts.projectId}`);

    const stageResults: StageResult[] = [];
    let retryCount = 0;
    const maxRetries = opts.maxRetries ?? 3;

    while (true) {
      // ── Re-enter from IDLE or REVERIFYING ─────────────────────────────────
      if (machine.state === "IDLE" || machine.state === "REVERIFYING") {
        machine.tryTransition("VERIFYING_STATIC", "Pipeline entry");
      }

      stageResults.length = 0;

      // ── Stage 1: STATIC ────────────────────────────────────────────────────
      if (!opts.skipStages?.includes("STATIC")) {
        audit.stageStarted("STATIC");
        const result = await new StaticVerifier().verify(opts.workspacePath, opts.signal);
        stageResults.push(result);
        if (!result.passed) {
          audit.stageFailed("STATIC", result.failureReason ?? "unknown");
          const classified = this._classifier.classify(result);
          const decision = retry.decide(classified, retryCount, maxRetries);
          if (!decision.shouldRetry) {
            machine.tryTransition("FAILED", result.failureReason ?? "STATIC failed");
            const verdict = authority.evaluate(proposal, stageResults);
            const recov = await recovery.recover(opts.projectId, classified);
            if (!recov.proceeded) return { ok: false, verdict, audit, stageResults, halted: recov.halted };
            retryCount++; continue;
          }
          audit.retryScheduled(decision.strategy.name, "STATIC");
          await retry.wait(decision.delayMs, opts.signal);
          retryCount++; continue;
        }
        audit.stagePassed("STATIC", result.evidence);
        machine.tryTransition("VERIFYING_BUILD", "STATIC passed");
      }

      // ── Stage 2: BUILD ─────────────────────────────────────────────────────
      if (!opts.skipStages?.includes("BUILD")) {
        audit.stageStarted("BUILD");
        const result = await new BuildVerifier().verify(opts.workspacePath, { signal: opts.signal, skipCache: true });
        stageResults.push(result);
        if (!result.passed) {
          audit.stageFailed("BUILD", result.failureReason ?? "unknown");
          const classified = this._classifier.classify(result);
          const decision = retry.decide(classified, retryCount, maxRetries);
          if (!decision.shouldRetry) {
            machine.tryTransition("FAILED", result.failureReason ?? "BUILD failed");
            const verdict = authority.evaluate(proposal, stageResults);
            return { ok: false, verdict, audit, stageResults, halted: false };
          }
          audit.retryScheduled(decision.strategy.name, "BUILD");
          await retry.wait(decision.delayMs, opts.signal);
          retryCount++; continue;
        }
        audit.stagePassed("BUILD", result.evidence);
        machine.tryTransition("VERIFYING_RUNTIME", "BUILD passed");

        // Snapshot a GRADE_B checkpoint after build passes
        const allEvidence = stageResults.flatMap((r) => [...r.evidence]);
        this._checkpoints.create(opts.projectId, opts.workspacePath, allEvidence);
      }

      // ── Stage 3: RUNTIME ──────────────────────────────────────────────────
      if (!opts.skipStages?.includes("RUNTIME")) {
        audit.stageStarted("RUNTIME");
        const result = await new RuntimeVerifier().verify(opts.projectId, { port: opts.port, previewUrl: opts.previewUrl, signal: opts.signal });
        stageResults.push(result);
        if (!result.passed) {
          audit.stageFailed("RUNTIME", result.failureReason ?? "unknown");
          const classified = this._classifier.classify(result);
          const decision = retry.decide(classified, retryCount, maxRetries);
          if (!decision.shouldRetry) {
            machine.tryTransition("FAILED", result.failureReason ?? "RUNTIME failed");
            const verdict = authority.evaluate(proposal, stageResults);
            const recov = await recovery.recover(opts.projectId, classified);
            if (!recov.proceeded) return { ok: false, verdict, audit, stageResults, halted: recov.halted };
            retryCount++; continue;
          }
          audit.retryScheduled(decision.strategy.name, "RUNTIME");
          await retry.wait(decision.delayMs, opts.signal);
          retryCount++; continue;
        }
        audit.stagePassed("RUNTIME", result.evidence);
        machine.tryTransition("VERIFYING_PREVIEW", "RUNTIME passed");
      }

      // ── Stage 4: PREVIEW ──────────────────────────────────────────────────
      if (!opts.skipStages?.includes("PREVIEW")) {
        audit.stageStarted("PREVIEW");
        const result = await new PreviewVerifier().verify({ port: opts.port, previewUrl: opts.previewUrl, signal: opts.signal });
        stageResults.push(result);
        if (!result.passed) {
          audit.stageFailed("PREVIEW", result.failureReason ?? "unknown");
        } else {
          audit.stagePassed("PREVIEW", result.evidence);
        }
        machine.tryTransition("RECONCILING_STATE", "PREVIEW complete");
      } else {
        machine.tryTransition("RECONCILING_STATE", "PREVIEW skipped");
      }

      // ── Stage 5: STATE RECONCILIATION ─────────────────────────────────────
      if (!opts.skipStages?.includes("STATE_RECONCILIATION")) {
        audit.stageStarted("STATE_RECONCILIATION");
        const allPriorEvidence = stageResults.flatMap((r) => [...r.evidence]);
        const result = new StateReconciler().verify(proposal, allPriorEvidence);
        stageResults.push(result);
        if (!result.passed) {
          audit.stageFailed("STATE_RECONCILIATION", result.failureReason ?? "unknown");
        } else {
          audit.stagePassed("STATE_RECONCILIATION", result.evidence);
        }
      }

      // ── Authorization ──────────────────────────────────────────────────────
      const allEvidence = stageResults.flatMap((r) => [...r.evidence]);
      this._checkpoints.create(opts.projectId, opts.workspacePath, allEvidence);

      const verdict = authority.evaluate(proposal, stageResults);
      if (verdict.authorized) {
        return { ok: true, verdict, audit, stageResults };
      }
      return { ok: false, verdict, audit, stageResults, halted: machine.state === "HALTED" };
    }
  }
}
