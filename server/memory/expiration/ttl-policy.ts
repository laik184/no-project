/**
 * server/memory/expiration/ttl-policy.ts
 *
 * TTLPolicy — configurable time-to-live policies for every memory type.
 * No storage. No state mutation. Pure policy lookup + calculation.
 */

import type { AgentClaim, VerifiedFact, MemorySystemConfig } from "../contracts/types.ts";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CLAIM_TTL_MS      =  5 * 60 * 1000;  //  5 minutes
const DEFAULT_FACT_TTL_MS       = 30 * 60 * 1000;  // 30 minutes
const DEFAULT_EVIDENCE_TTL_MS   =  2 * 60 * 1000;  //  2 minutes
const MIN_CONFIDENCE_CLAIM_TTL  = 30 * 1000;        // 30 seconds (low confidence)
const HIGH_CONFIDENCE_MULTIPLIER = 2.0;             // >0.8 confidence lives longer

export type MemoryTTLConfig = {
  readonly claimTtlMs: number;
  readonly factTtlMs: number;
  readonly evidenceTtlMs: number;
};

export class TTLPolicy {
  private readonly _cfg: MemoryTTLConfig;

  constructor(config?: Pick<MemorySystemConfig, "defaultClaimTtlMs" | "defaultFactTtlMs">) {
    this._cfg = {
      claimTtlMs:    config?.defaultClaimTtlMs  ?? DEFAULT_CLAIM_TTL_MS,
      factTtlMs:     config?.defaultFactTtlMs   ?? DEFAULT_FACT_TTL_MS,
      evidenceTtlMs: DEFAULT_EVIDENCE_TTL_MS,
    };
  }

  claimExpiresAt(createdAt: number, confidence: number): number {
    let ttl = this._cfg.claimTtlMs;
    if (confidence < 0.3)  ttl = Math.min(ttl, MIN_CONFIDENCE_CLAIM_TTL);
    if (confidence >= 0.8) ttl = Math.floor(ttl * HIGH_CONFIDENCE_MULTIPLIER);
    return createdAt + ttl;
  }

  factExpiresAt(verifiedAt: number, overrideTtlMs?: number): number | undefined {
    if (overrideTtlMs === 0) return undefined; // never expires
    const ttl = overrideTtlMs ?? this._cfg.factTtlMs;
    return verifiedAt + ttl;
  }

  isClaimExpired(claim: AgentClaim, now: number): boolean {
    return now >= claim.expiresAt;
  }

  isFactExpired(fact: VerifiedFact, now: number): boolean {
    if (!fact.expiresAt) return false;
    return now >= fact.expiresAt;
  }

  isFactStale(fact: VerifiedFact, now: number): boolean {
    if (!fact.expiresAt) return false;
    const stalePeriod = (fact.expiresAt - fact.verifiedAt) * 0.8;
    return now >= fact.verifiedAt + stalePeriod;
  }

  freshnessRatio(verifiedAt: number, expiresAt: number | undefined, now: number): number {
    if (!expiresAt) return 1.0;
    const total = expiresAt - verifiedAt;
    if (total <= 0) return 0;
    const elapsed = now - verifiedAt;
    return Math.max(0, Math.min(1, 1 - elapsed / total));
  }

  evidenceTtlMs(): number { return this._cfg.evidenceTtlMs; }
}
