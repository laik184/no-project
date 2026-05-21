/**
 * server/memory/claims/claim-store.ts
 *
 * ClaimStore — storage for AgentClaims.
 * Claims are mutable in status only (unverified → verified|contradicted|expired).
 * All status transitions emit events. Claims are never deleted — only expired/contradicted.
 * LLMs write claims; the PromotionPipeline or ContradictionDetector changes status.
 */

import type { AgentClaim, ClaimStatus, MemoryId, Namespace } from "../contracts/types.ts";
import type { EventLog } from "../events/event-log.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";
import type { Clock } from "../infrastructure/clock.ts";
import type { TTLPolicy } from "../expiration/ttl-policy.ts";
import {
  claimCreatedEvent,
  claimExpiredEvent,
  claimContradictedEvent,
} from "../events/event-types.ts";

export type ClaimWriteInput = {
  id: string;
  claim: string;
  namespace: Namespace;
  sourceRunId: string;
  confidence: number;
  relatedEvidenceIds?: readonly string[];
};

export class ClaimStore {
  private readonly _claims = new Map<MemoryId, AgentClaim>();

  constructor(
    private readonly _events: EventLog,
    private readonly _checksum: ChecksumEngine,
    private readonly _clock: Clock,
    private readonly _ttl: TTLPolicy,
  ) {}

  write(input: ClaimWriteInput): AgentClaim {
    const now = this._clock.now();
    const confidence = Math.max(0, Math.min(0.99, input.confidence));
    const body = { claim: input.claim, namespace: input.namespace, sourceRunId: input.sourceRunId };
    const claim: AgentClaim = Object.freeze({
      id:                   input.id,
      claim:                input.claim,
      namespace:            input.namespace,
      createdAt:            now,
      expiresAt:            this._ttl.claimExpiresAt(now, confidence),
      sourceRunId:          input.sourceRunId,
      confidence,
      verificationStatus:   "unverified" as ClaimStatus,
      relatedEvidenceIds:   Object.freeze([...(input.relatedEvidenceIds ?? [])]),
      checksum:             this._checksum.compute(body),
    });

    this._claims.set(claim.id, claim);
    this._events.append(claimCreatedEvent(claim.id, claim.sourceRunId, claim.namespace));
    return claim;
  }

  markExpired(id: MemoryId, reason = "TTL elapsed"): boolean {
    const c = this._claims.get(id);
    if (!c || c.verificationStatus !== "unverified") return false;
    this._claims.set(id, Object.freeze({ ...c, verificationStatus: "expired" as ClaimStatus }));
    this._events.append(claimExpiredEvent(id, reason));
    return true;
  }

  markContradicted(id: MemoryId, contradictionId: string, evidence: string): boolean {
    const c = this._claims.get(id);
    if (!c) return false;
    this._claims.set(id, Object.freeze({ ...c, verificationStatus: "contradicted" as ClaimStatus }));
    this._events.append(claimContradictedEvent(id, contradictionId, evidence));
    return true;
  }

  markVerified(id: MemoryId): boolean {
    const c = this._claims.get(id);
    if (!c || c.verificationStatus !== "unverified") return false;
    this._claims.set(id, Object.freeze({ ...c, verificationStatus: "verified" as ClaimStatus }));
    return true;
  }

  getById(id: MemoryId): AgentClaim | undefined { return this._claims.get(id); }

  listByStatus(status: ClaimStatus, namespace?: Namespace): readonly AgentClaim[] {
    return [...this._claims.values()].filter(
      (c) => c.verificationStatus === status && (!namespace || c.namespace === namespace)
    );
  }

  listNamespace(namespace: Namespace): readonly AgentClaim[] {
    return [...this._claims.values()].filter((c) => c.namespace === namespace);
  }

  listAll(): readonly AgentClaim[] { return [...this._claims.values()]; }
  get size(): number { return this._claims.size; }
}
