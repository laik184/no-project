/**
 * server/memory/verification/promotion-pipeline.ts
 *
 * PromotionPipeline — deterministic CLAIM → FACT promotion.
 *
 * Pipeline stages:
 *   1. Claim lookup & validation
 *   2. Promotion validation (evidence, verifier, key)
 *   3. Contradiction scan (does existing state conflict?)
 *   4. Fact write + claim status update
 *   5. Post-write contradiction sweep (invalidate stale same-key facts)
 *   6. Event emission
 *
 * INVARIANT: LLMs never call this. Only tool-backed verifiers do.
 * INVARIANT: promotion requires external evidence — no self-promotion.
 */

import type { PromotionRequest, PromotionResult, Evidence } from "../contracts/types.ts";
import type { ClaimStore } from "../claims/claim-store.ts";
import type { FactStore } from "../facts/fact-store.ts";
import type { EvidenceCollector } from "./evidence-collector.ts";
import type { PromotionValidator } from "./promotion-validator.ts";
import type { ContradictionDetector } from "../contradiction/contradiction-detector.ts";
import type { EventLog } from "../events/event-log.ts";
import type { IdGenerator } from "../infrastructure/id-generator.ts";
import type { Clock } from "../infrastructure/clock.ts";
import type { TTLPolicy } from "../expiration/ttl-policy.ts";
import { claimPromotedEvent, verificationExecutedEvent } from "../events/event-types.ts";

export type PromoteOptions = {
  factKey: string;
  factValue: unknown;
  factTtlMs?: number;
};

export class PromotionPipeline {
  constructor(
    private readonly _claims:       ClaimStore,
    private readonly _facts:        FactStore,
    private readonly _evidence:     EvidenceCollector,
    private readonly _validator:    PromotionValidator,
    private readonly _contradiction: ContradictionDetector,
    private readonly _events:       EventLog,
    private readonly _ids:          IdGenerator,
    private readonly _clock:        Clock,
    private readonly _ttl:          TTLPolicy,
  ) {}

  async promote(request: PromotionRequest, opts: PromoteOptions): Promise<PromotionResult> {
    // ── Stage 1: Claim lookup ─────────────────────────────────────────────────
    const claim = this._claims.getById(request.claimId);
    if (!claim) return { ok: false, reason: "claim not found", contradicted: false };

    // ── Stage 2: Filter stale evidence ───────────────────────────────────────
    const validEvidence = this._evidence.filterValid(request.evidence);
    if (validEvidence.length === 0) {
      this._events.append(verificationExecutedEvent(request.claimId, "failed", request.verifier));
      return { ok: false, reason: "all evidence is stale or tampered", contradicted: false };
    }

    const freshRequest: PromotionRequest = { ...request, evidence: validEvidence };

    // ── Stage 3: Structural validation ───────────────────────────────────────
    const structCheck = this._validator.validate(freshRequest, claim, opts.factValue);
    if (!structCheck.valid) {
      this._events.append(verificationExecutedEvent(request.claimId, "failed", request.verifier));
      return { ok: false, reason: structCheck.reason, contradicted: structCheck.fatal };
    }

    const keyCheck = this._validator.validateFactKey(opts.factKey);
    if (!keyCheck.valid) {
      return { ok: false, reason: keyCheck.reason, contradicted: keyCheck.fatal };
    }

    // ── Stage 4: Contradiction scan ───────────────────────────────────────────
    const existingFact = this._facts.getByKey(opts.factKey, request.namespace);
    if (existingFact && String(existingFact.value) !== String(opts.factValue)) {
      // New evidence contradicts an existing fact — invalidate old first
      this._facts.invalidate(existingFact.id, `contradicted by promotion of claim ${claim.id}`);
    }

    // ── Stage 5: Write fact ───────────────────────────────────────────────────
    const factId = this._ids.generate("fact");
    const expiresAt = this._ttl.factExpiresAt(this._clock.now(), opts.factTtlMs);
    const fact = this._facts.write({
      id:          factId,
      key:         opts.factKey,
      namespace:   request.namespace,
      value:       opts.factValue,
      evidenceIds: validEvidence.map((e) => e.id),
      verifier:    request.verifier,
      expiresAt,
    });

    // ── Stage 6: Mark claim verified + post-write contradiction sweep ─────────
    this._claims.markVerified(claim.id);
    this._contradiction.onFactWritten(fact);
    this._contradiction.checkClaimsAgainstEvidence(opts.factKey, opts.factValue, request.namespace);

    // ── Stage 7: Events ───────────────────────────────────────────────────────
    this._events.append(verificationExecutedEvent(request.claimId, "passed", request.verifier));
    this._events.append(claimPromotedEvent(request.claimId, factId, request.verifier));

    return { ok: true, factId };
  }
}
