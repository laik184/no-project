/**
 * server/memory/contracts/types.ts
 *
 * All shared contracts for the memory subsystem.
 * No logic. No imports. Pure type definitions.
 * Every module imports from here — never from each other's internals.
 */

// ── Core identity types ──────────────────────────────────────────────────────

export type MemoryId        = string;
export type RunId           = string;
export type Namespace       = string;
export type ChecksumHex     = string;

// ── Verified Fact ────────────────────────────────────────────────────────────
// Only runtime/tool-verified information may populate this type.
// LLMs NEVER write directly to this store.

export type VerifiedFact = {
  readonly id: MemoryId;
  readonly key: string;
  readonly namespace: Namespace;
  readonly value: unknown;
  readonly evidenceIds: readonly string[];
  readonly verifiedAt: number;
  readonly expiresAt?: number;
  readonly verifier: string;       // tool name or subsystem
  readonly confidence: 1.0;        // facts are always confidence=1
  readonly checksum: ChecksumHex;
  readonly invalidatedAt?: number;
  readonly invalidatedBy?: string; // contradiction id
};

// ── Agent Claim ──────────────────────────────────────────────────────────────
// Speculative / inferred. Never trusted. Injected with [CLAIM — UNVERIFIED].

export type ClaimStatus = "unverified" | "verified" | "contradicted" | "expired";

export type AgentClaim = {
  readonly id: MemoryId;
  readonly claim: string;
  readonly namespace: Namespace;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly sourceRunId: RunId;
  readonly confidence: number;       // 0 – 0.99
  readonly verificationStatus: ClaimStatus;
  readonly relatedEvidenceIds: readonly string[];
  readonly checksum: ChecksumHex;
};

// ── Evidence ─────────────────────────────────────────────────────────────────
// Raw observations from tools / runtime. Feed into promotion pipeline.

export type Evidence = {
  readonly id: string;
  readonly source: string;      // tool or subsystem name
  readonly collectedAt: number;
  readonly data: unknown;
  readonly checksum: ChecksumHex;
  readonly ttlMs: number;
};

// ── Memory Events (append-only log entries) ──────────────────────────────────

export type MemoryEventKind =
  | "FACT_VERIFIED"
  | "FACT_INVALIDATED"
  | "CLAIM_CREATED"
  | "CLAIM_EXPIRED"
  | "CLAIM_CONTRADICTED"
  | "CLAIM_PROMOTED"
  | "CONTEXT_BUILT"
  | "VERIFICATION_EXECUTED"
  | "CONTRADICTION_DETECTED"
  | "GOVERNANCE_VIOLATION"
  | "EXPIRATION_TRIGGERED";

export type MemoryEvent =
  | { kind: "FACT_VERIFIED";          factId: string; key: string; verifier: string; namespace: string }
  | { kind: "FACT_INVALIDATED";       factId: string; reason: string; contradictionId?: string }
  | { kind: "CLAIM_CREATED";          claimId: string; sourceRunId: string; namespace: string }
  | { kind: "CLAIM_EXPIRED";          claimId: string; reason: string }
  | { kind: "CLAIM_CONTRADICTED";     claimId: string; contradictionId: string; evidence: string }
  | { kind: "CLAIM_PROMOTED";         claimId: string; factId: string; verifier: string }
  | { kind: "CONTEXT_BUILT";          namespace: string; blockCount: number; checksum: string }
  | { kind: "VERIFICATION_EXECUTED";  claimId: string; outcome: "passed" | "failed"; verifier: string }
  | { kind: "CONTRADICTION_DETECTED"; targetId: string; targetType: "fact" | "claim"; reason: string }
  | { kind: "GOVERNANCE_VIOLATION";   violationType: string; targetId: string; detail: string }
  | { kind: "EXPIRATION_TRIGGERED";   targetId: string; targetType: "fact" | "claim" };

export type MemoryEventEnvelope = {
  readonly id: string;
  readonly sequenceNo: number;
  readonly timestamp: number;
  readonly previousHash: ChecksumHex;
  readonly hash: ChecksumHex;
  readonly payload: MemoryEvent;
};

// ── Promotion ─────────────────────────────────────────────────────────────────

export type PromotionRequest = {
  readonly claimId: string;
  readonly verifier: string;
  readonly evidence: readonly Evidence[];
  readonly namespace: Namespace;
  readonly runId: RunId;
};

export type PromotionResult =
  | { ok: true;  factId: string }
  | { ok: false; reason: string; contradicted: boolean };

// ── Retrieval ─────────────────────────────────────────────────────────────────

export type RetrievalQuery = {
  readonly namespace?: Namespace;
  readonly keys?: readonly string[];
  readonly includeExpired?: boolean;
  readonly includeContradicted?: boolean;
  readonly minConfidence?: number;
  readonly maxAge?: number;    // ms
  readonly limit?: number;
};

export type ScoredFact  = { item: VerifiedFact;  score: number };
export type ScoredClaim = { item: AgentClaim;    score: number };

export type RetrievalResult = {
  readonly facts:  readonly ScoredFact[];
  readonly claims: readonly ScoredClaim[];
  readonly totalFacts:  number;
  readonly totalClaims: number;
  readonly retrievedAt: number;
};

// ── Context Assembly ──────────────────────────────────────────────────────────

export type ContextBlockKind = "VERIFIED_FACT" | "RUNTIME_OBSERVATION" | "TASK_CONTEXT" | "UNVERIFIED_CLAIM";

export type ContextBlock = {
  readonly id: string;
  readonly kind: ContextBlockKind;
  readonly content: string;
  readonly sourceId: string;
  readonly confidence: number;
  readonly verifiedAt?: number;
  readonly checksum: ChecksumHex;
};

export type ContextRequest = {
  readonly namespace: Namespace;
  readonly runId: RunId;
  readonly taskDescription?: string;
  readonly maxBlocks?: number;
  readonly includeUnverified?: boolean;
};

// ── Governance ────────────────────────────────────────────────────────────────

export type GovernanceViolationType =
  | "STALE_REUSE"
  | "RECURSIVE_HALLUCINATION"
  | "SELF_CONFIRMATION_LOOP"
  | "CONTRADICTORY_STATE"
  | "MEMORY_EXPLOSION"
  | "CONTEXT_DRIFT"
  | "LOW_CONFIDENCE_INJECTION";

export type GovernanceViolation = {
  readonly id: string;
  readonly type: GovernanceViolationType;
  readonly targetId: string;
  readonly namespace: Namespace;
  readonly detectedAt: number;
  readonly detail: string;
  readonly blocked: boolean;
};

// ── System Configuration ──────────────────────────────────────────────────────

export type MemorySystemConfig = {
  readonly defaultClaimTtlMs?: number;    // default: 5 min
  readonly defaultFactTtlMs?: number;     // default: 30 min
  readonly maxClaimsPerNamespace?: number; // default: 200
  readonly maxFactsPerNamespace?: number;  // default: 500
  readonly minPromotionEvidence?: number;  // default: 1
  readonly enableGovernance?: boolean;     // default: true
};
