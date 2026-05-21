/**
 * server/memory/events/event-types.ts
 *
 * Type guards and factory helpers for MemoryEvent discriminated union.
 * Zero runtime logic — pure type utilities.
 * Import from contracts/types.ts for the types themselves.
 */

import type { MemoryEvent, MemoryEventKind } from "../contracts/types.ts";

// ── Type guards ───────────────────────────────────────────────────────────────

export function isFactEvent(e: MemoryEvent): e is Extract<MemoryEvent, { kind: "FACT_VERIFIED" | "FACT_INVALIDATED" }> {
  return e.kind === "FACT_VERIFIED" || e.kind === "FACT_INVALIDATED";
}

export function isClaimEvent(e: MemoryEvent): e is Extract<MemoryEvent, { kind: "CLAIM_CREATED" | "CLAIM_EXPIRED" | "CLAIM_CONTRADICTED" | "CLAIM_PROMOTED" }> {
  return e.kind === "CLAIM_CREATED" || e.kind === "CLAIM_EXPIRED"
    || e.kind === "CLAIM_CONTRADICTED" || e.kind === "CLAIM_PROMOTED";
}

export function isContradictionEvent(e: MemoryEvent): boolean {
  return e.kind === "CONTRADICTION_DETECTED" || e.kind === "CLAIM_CONTRADICTED";
}

export function isGovernanceEvent(e: MemoryEvent): e is Extract<MemoryEvent, { kind: "GOVERNANCE_VIOLATION" }> {
  return e.kind === "GOVERNANCE_VIOLATION";
}

// ── Factory helpers ───────────────────────────────────────────────────────────

export function factVerifiedEvent(factId: string, key: string, verifier: string, namespace: string): Extract<MemoryEvent, { kind: "FACT_VERIFIED" }> {
  return { kind: "FACT_VERIFIED", factId, key, verifier, namespace };
}

export function factInvalidatedEvent(factId: string, reason: string, contradictionId?: string): Extract<MemoryEvent, { kind: "FACT_INVALIDATED" }> {
  return { kind: "FACT_INVALIDATED", factId, reason, contradictionId };
}

export function claimCreatedEvent(claimId: string, sourceRunId: string, namespace: string): Extract<MemoryEvent, { kind: "CLAIM_CREATED" }> {
  return { kind: "CLAIM_CREATED", claimId, sourceRunId, namespace };
}

export function claimExpiredEvent(claimId: string, reason: string): Extract<MemoryEvent, { kind: "CLAIM_EXPIRED" }> {
  return { kind: "CLAIM_EXPIRED", claimId, reason };
}

export function claimContradictedEvent(claimId: string, contradictionId: string, evidence: string): Extract<MemoryEvent, { kind: "CLAIM_CONTRADICTED" }> {
  return { kind: "CLAIM_CONTRADICTED", claimId, contradictionId, evidence };
}

export function claimPromotedEvent(claimId: string, factId: string, verifier: string): Extract<MemoryEvent, { kind: "CLAIM_PROMOTED" }> {
  return { kind: "CLAIM_PROMOTED", claimId, factId, verifier };
}

export function verificationExecutedEvent(claimId: string, outcome: "passed" | "failed", verifier: string): Extract<MemoryEvent, { kind: "VERIFICATION_EXECUTED" }> {
  return { kind: "VERIFICATION_EXECUTED", claimId, outcome, verifier };
}

export function contradictionDetectedEvent(targetId: string, targetType: "fact" | "claim", reason: string): Extract<MemoryEvent, { kind: "CONTRADICTION_DETECTED" }> {
  return { kind: "CONTRADICTION_DETECTED", targetId, targetType, reason };
}

export function governanceViolationEvent(violationType: string, targetId: string, detail: string): Extract<MemoryEvent, { kind: "GOVERNANCE_VIOLATION" }> {
  return { kind: "GOVERNANCE_VIOLATION", violationType, targetId, detail };
}

export function expirationTriggeredEvent(targetId: string, targetType: "fact" | "claim"): Extract<MemoryEvent, { kind: "EXPIRATION_TRIGGERED" }> {
  return { kind: "EXPIRATION_TRIGGERED", targetId, targetType };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function describeEvent(e: MemoryEvent): string {
  switch (e.kind) {
    case "FACT_VERIFIED":         return `Fact verified: ${e.key} by ${e.verifier}`;
    case "FACT_INVALIDATED":      return `Fact invalidated: ${e.factId} — ${e.reason}`;
    case "CLAIM_CREATED":         return `Claim created: ${e.claimId} (run=${e.sourceRunId})`;
    case "CLAIM_EXPIRED":         return `Claim expired: ${e.claimId}`;
    case "CLAIM_CONTRADICTED":    return `Claim contradicted: ${e.claimId}`;
    case "CLAIM_PROMOTED":        return `Claim promoted → fact ${e.factId}`;
    case "CONTEXT_BUILT":         return `Context built: ${e.blockCount} blocks (ns=${e.namespace})`;
    case "VERIFICATION_EXECUTED": return `Verification ${e.outcome}: ${e.claimId}`;
    case "CONTRADICTION_DETECTED":return `Contradiction: ${e.targetType} ${e.targetId}`;
    case "GOVERNANCE_VIOLATION":  return `Governance [${e.violationType}]: ${e.targetId}`;
    case "EXPIRATION_TRIGGERED":  return `Expired: ${e.targetType} ${e.targetId}`;
    default:                       return `Unknown event`;
  }
}
