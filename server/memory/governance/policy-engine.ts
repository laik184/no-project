/**
 * server/memory/governance/policy-engine.ts
 *
 * PolicyEngine — declarative governance rules for the memory system.
 * Each policy is a pure predicate function that returns a violation or null.
 * No I/O. No side effects. Inject and call — results go to GovernanceLayer.
 */

import type {
  VerifiedFact,
  AgentClaim,
  GovernanceViolationType,
  MemorySystemConfig,
} from "../contracts/types.ts";

export type PolicyCheckResult =
  | null
  | { type: GovernanceViolationType; detail: string; block: boolean };

export class PolicyEngine {
  private readonly _maxClaimsPerNs: number;
  private readonly _maxFactsPerNs:  number;

  constructor(config?: Pick<MemorySystemConfig, "maxClaimsPerNamespace" | "maxFactsPerNamespace">) {
    this._maxClaimsPerNs = config?.maxClaimsPerNamespace ?? 200;
    this._maxFactsPerNs  = config?.maxFactsPerNamespace  ?? 500;
  }

  checkClaimCount(activeClaims: number, namespace: string): PolicyCheckResult {
    if (activeClaims > this._maxClaimsPerNs) {
      return {
        type: "MEMORY_EXPLOSION",
        detail: `namespace "${namespace}" has ${activeClaims} active claims (limit: ${this._maxClaimsPerNs})`,
        block: false,
      };
    }
    return null;
  }

  checkFactCount(activeFacts: number, namespace: string): PolicyCheckResult {
    if (activeFacts > this._maxFactsPerNs) {
      return {
        type: "MEMORY_EXPLOSION",
        detail: `namespace "${namespace}" has ${activeFacts} facts (limit: ${this._maxFactsPerNs})`,
        block: false,
      };
    }
    return null;
  }

  checkClaimConfidence(claim: AgentClaim): PolicyCheckResult {
    if (claim.confidence < 0.1) {
      return {
        type: "LOW_CONFIDENCE_INJECTION",
        detail: `claim ${claim.id} has confidence ${claim.confidence} — below safe injection threshold`,
        block: true,
      };
    }
    return null;
  }

  checkStaleFact(fact: VerifiedFact, now: number): PolicyCheckResult {
    if (!fact.expiresAt) return null;
    const age = now - fact.verifiedAt;
    const ttl = fact.expiresAt - fact.verifiedAt;
    if (ttl > 0 && age / ttl > 0.9) {
      return {
        type: "STALE_REUSE",
        detail: `fact "${fact.key}" is ${Math.round((age / ttl) * 100)}% through its TTL`,
        block: false,
      };
    }
    return null;
  }

  checkSelfConfirmationLoop(claim: AgentClaim, priorRunClaims: readonly AgentClaim[]): PolicyCheckResult {
    const text = claim.claim.trim().toLowerCase();
    const duplicate = priorRunClaims.find(
      (c) => c.id !== claim.id && c.claim.trim().toLowerCase() === text
    );
    if (duplicate) {
      return {
        type: "SELF_CONFIRMATION_LOOP",
        detail: `claim text submitted again (prior: ${duplicate.id}) — recursive hallucination risk`,
        block: true,
      };
    }
    return null;
  }

  checkContextDrift(
    priorFactCount: number,
    currentFactCount: number,
    priorClaimCount: number,
    currentClaimCount: number,
  ): PolicyCheckResult {
    const factDrift  = currentFactCount  - priorFactCount;
    const claimDrift = currentClaimCount - priorClaimCount;
    if (claimDrift > 50 && factDrift < 1) {
      return {
        type: "CONTEXT_DRIFT",
        detail: `+${claimDrift} claims with no new facts — agent may be hallucinating progress`,
        block: false,
      };
    }
    return null;
  }
}
