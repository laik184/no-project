/**
 * server/fail-closed/gates/completion-authority.ts
 *
 * CompletionAuthority — the ONLY module that may authorize VERIFIED_SUCCESS.
 *
 * The LLM NEVER decides completion. It submits a CompletionProposal.
 * This module evaluates the proposal against all verified evidence gates.
 *
 * Authorization requires ALL of:
 *   1. Static verification passed
 *   2. Build verification passed
 *   3. Runtime verification passed
 *   4. Preview verification passed (unless explicitly skipped)
 *   5. State reconciliation passed
 *   6. All evidence gates clear
 *   7. State machine in RECONCILING_STATE
 *
 * INVARIANT: A proposal is NEVER auto-authorized.
 * INVARIANT: Evidence exhaustion → DENIED (never partial-pass).
 * INVARIANT: Only one VERIFIED_SUCCESS may be emitted per run.
 */

import type {
  CompletionProposal,
  CompletionVerdict,
  StageResult,
  Evidence,
} from "../contracts/types.ts";
import type { VerificationStateMachine } from "../state-machine/verification-state-machine.ts";
import type { EvidenceGate }             from "./evidence-gate.ts";
import type { VerificationAuditLog }     from "../audit/verification-audit-log.ts";

export class CompletionAuthority {
  private _authorized = false;

  constructor(
    private readonly _machine: VerificationStateMachine,
    private readonly _gate:    EvidenceGate,
    private readonly _audit:   VerificationAuditLog,
  ) {}

  /**
   * Evaluates a CompletionProposal against all stage results.
   * Returns a CompletionVerdict — binding for the pipeline.
   */
  evaluate(
    proposal: CompletionProposal,
    stageResults: readonly StageResult[],
  ): CompletionVerdict {
    const t0 = Date.now();
    this._audit.completionProposed(
      `Proposed by ${proposal.proposedBy} for run ${proposal.runId} ` +
      `(${proposal.claimedPostconditions.length} postconditions claimed)`
    );

    // ── Guard: already authorized ─────────────────────────────────────────────
    if (this._authorized) {
      return this._deny(proposal.runId, ["ALREADY_AUTHORIZED"], "CompletionAuthority already issued a verdict for this run", t0);
    }

    // ── Guard: LLM cannot self-authorize ──────────────────────────────────────
    if (proposal.proposedBy === "llm" || proposal.proposedBy === "model") {
      this._audit.gateBlocked(`LLM self-authorization attempt blocked for run ${proposal.runId}`);
      // Still evaluate — LLM proposals go through the same pipeline
    }

    // ── Guard: state machine must be in RECONCILING_STATE ────────────────────
    if (this._machine.state !== "RECONCILING_STATE" && this._machine.state !== "REVERIFYING") {
      return this._deny(
        proposal.runId,
        ["WRONG_STATE"],
        `Cannot authorize from state ${this._machine.state} — must be RECONCILING_STATE`,
        t0,
      );
    }

    // ── Collect all evidence from passed stages ───────────────────────────────
    const allEvidence: Evidence[] = [];
    const failedGates: string[]   = [];

    const required = ["STATIC", "BUILD", "RUNTIME", "STATE_RECONCILIATION"] as const;
    const optional = ["PREVIEW"] as const;

    for (const stage of required) {
      const result = stageResults.find((r) => r.stage === stage);
      if (!result) {
        failedGates.push(`Stage ${stage}: not executed`);
        continue;
      }
      if (!result.passed) {
        failedGates.push(`Stage ${stage}: ${result.failureReason ?? "failed"}`);
        continue;
      }
      allEvidence.push(...result.evidence);

      // Evidence gate evaluation
      const gateResult = this._gate.evaluate(stage as any, result.evidence);
      if (!gateResult.passed) {
        const reason = this._gate.describeFailure(stage as any, gateResult);
        failedGates.push(reason);
        this._audit.gateBlocked(reason, stage as any);
      }
    }

    // Preview is semi-optional — record if failed but don't hard-block
    for (const stage of optional) {
      const result = stageResults.find((r) => r.stage === stage);
      if (result) {
        allEvidence.push(...result.evidence);
        if (!result.passed) {
          failedGates.push(`Stage ${stage}: ${result.failureReason ?? "failed"}`);
        }
      }
    }

    if (failedGates.length > 0) {
      return this._deny(
        proposal.runId,
        failedGates,
        `${failedGates.length} gate(s) failed: ${failedGates[0]}`,
        t0,
      );
    }

    // ── All gates passed — authorize ──────────────────────────────────────────
    this._authorized = true;
    this._machine.transition("VERIFIED_SUCCESS", "CompletionAuthority: all gates passed");
    this._audit.completionAuthorized(allEvidence);

    return Object.freeze({
      authorized:  true,
      runId:       proposal.runId,
      evidence:    Object.freeze(allEvidence),
      verifiedAt:  Date.now(),
      durationMs:  Date.now() - t0,
    });
  }

  get hasAuthorized(): boolean { return this._authorized; }

  private _deny(
    runId: string,
    failedGates: readonly string[],
    deniedReason: string,
    t0: number,
  ): CompletionVerdict {
    this._audit.completionDenied(deniedReason);
    return Object.freeze({
      authorized:         false,
      runId,
      failedGates:        Object.freeze([...failedGates]),
      deniedReason,
      durationMs:         Date.now() - t0,
      recoverySuggested:  failedGates.some((g) => g.includes("RUNTIME") || g.includes("HTTP")),
    });
  }
}
