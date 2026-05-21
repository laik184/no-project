/**
 * server/memory/governance/governance-layer.ts
 *
 * GovernanceLayer — enforces memory safety policies at write time.
 *
 * Responsibilities:
 *   - Run PolicyEngine checks before claim/fact writes
 *   - Block writes that violate fatal policies (fail-closed)
 *   - Record all violations via AuditLogger
 *   - Detect memory explosion, context drift, hallucination loops
 *
 * INVARIANT: blocking violations cause write to return an error.
 * INVARIANT: non-blocking violations are recorded but write proceeds.
 */

import type { AgentClaim, VerifiedFact, Namespace } from "../contracts/types.ts";
import type { FactStore } from "../facts/fact-store.ts";
import type { ClaimStore } from "../claims/claim-store.ts";
import type { PolicyEngine } from "./policy-engine.ts";
import type { AuditLogger } from "./audit-logger.ts";
import type { Clock } from "../infrastructure/clock.ts";

export type WriteDecision =
  | { allowed: true; warnings: readonly string[] }
  | { allowed: false; reason: string };

export class GovernanceLayer {
  constructor(
    private readonly _facts:   FactStore,
    private readonly _claims:  ClaimStore,
    private readonly _policy:  PolicyEngine,
    private readonly _audit:   AuditLogger,
    private readonly _clock:   Clock,
  ) {}

  /** Called before writing a new AgentClaim. Returns allow/block decision. */
  checkClaimWrite(claim: AgentClaim): WriteDecision {
    const warnings: string[] = [];
    const namespace = claim.namespace;

    // Policy: confidence floor
    const confResult = this._policy.checkClaimConfidence(claim);
    if (confResult) {
      this._audit.recordViolation(confResult.type, claim.id, namespace, confResult.detail, confResult.block);
      if (confResult.block) return { allowed: false, reason: confResult.detail };
      warnings.push(confResult.detail);
    }

    // Policy: claim count explosion
    const activeClaims = this._claims.listByStatus("unverified", namespace).length;
    const countResult = this._policy.checkClaimCount(activeClaims, namespace);
    if (countResult) {
      this._audit.recordViolation(countResult.type, claim.id, namespace, countResult.detail, countResult.block);
      if (countResult.block) return { allowed: false, reason: countResult.detail };
      warnings.push(countResult.detail);
    }

    // Policy: self-confirmation loop
    const priorClaims = this._claims.listByStatus("unverified", namespace)
      .filter((c) => c.sourceRunId === claim.sourceRunId);
    const loopResult = this._policy.checkSelfConfirmationLoop(claim, priorClaims);
    if (loopResult) {
      this._audit.recordViolation(loopResult.type, claim.id, namespace, loopResult.detail, loopResult.block);
      if (loopResult.block) return { allowed: false, reason: loopResult.detail };
      warnings.push(loopResult.detail);
    }

    return { allowed: true, warnings: Object.freeze(warnings) };
  }

  /** Called before reading a fact for context injection. Warns on staleness. */
  checkFactRead(fact: VerifiedFact): WriteDecision {
    const now = this._clock.now();
    const staleResult = this._policy.checkStaleFact(fact, now);
    if (staleResult) {
      this._audit.recordViolation(staleResult.type, fact.id, fact.namespace, staleResult.detail, staleResult.block);
      if (staleResult.block) return { allowed: false, reason: staleResult.detail };
      return { allowed: true, warnings: Object.freeze([staleResult.detail]) };
    }
    return { allowed: true, warnings: Object.freeze([]) };
  }

  /** Periodic drift check across a namespace. */
  checkNamespaceDrift(
    namespace: Namespace,
    priorFactCount: number,
    priorClaimCount: number,
  ): WriteDecision {
    const summary = {
      facts:  this._facts.listNamespace(namespace).length,
      claims: this._claims.listByStatus("unverified", namespace).length,
    };
    const drift = this._policy.checkContextDrift(
      priorFactCount, summary.facts, priorClaimCount, summary.claims
    );
    if (drift) {
      this._audit.recordViolation(drift.type, namespace, namespace, drift.detail, drift.block);
      if (drift.block) return { allowed: false, reason: drift.detail };
      return { allowed: true, warnings: Object.freeze([drift.detail]) };
    }
    return { allowed: true, warnings: Object.freeze([]) };
  }
}
