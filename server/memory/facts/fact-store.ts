/**
 * server/memory/facts/fact-store.ts
 *
 * FactStore — immutable, append-only storage for VerifiedFacts.
 * Facts are never mutated. Invalidation creates a new version with
 * invalidatedAt stamped. All writes emit events to the EventLog.
 * LLMs never write here — only the PromotionPipeline does.
 */

import type { VerifiedFact, MemoryId, Namespace } from "../contracts/types.ts";
import type { EventLog } from "../events/event-log.ts";
import type { ChecksumEngine } from "../infrastructure/checksum.ts";
import type { Clock } from "../infrastructure/clock.ts";
import { factVerifiedEvent, factInvalidatedEvent } from "../events/event-types.ts";

export type FactWriteInput = Omit<VerifiedFact, "id" | "checksum" | "verifiedAt" | "expiresAt" | "invalidatedAt" | "invalidatedBy" | "confidence"> & {
  id: string;
  expiresAt?: number;
};

export class FactStore {
  private readonly _facts = new Map<MemoryId, VerifiedFact>();

  constructor(
    private readonly _events: EventLog,
    private readonly _checksum: ChecksumEngine,
    private readonly _clock: Clock,
  ) {}

  write(input: FactWriteInput): VerifiedFact {
    const verifiedAt = this._clock.now();
    const body = {
      key: input.key, namespace: input.namespace, value: input.value,
      evidenceIds: input.evidenceIds, verifiedAt, verifier: input.verifier,
    };
    const fact: VerifiedFact = Object.freeze({
      id:          input.id,
      key:         input.key,
      namespace:   input.namespace,
      value:       input.value,
      evidenceIds: Object.freeze([...input.evidenceIds]),
      verifiedAt,
      expiresAt:   input.expiresAt,
      verifier:    input.verifier,
      confidence:  1.0,
      checksum:    this._checksum.compute(body),
    });

    this._facts.set(fact.id, fact);
    this._events.append(factVerifiedEvent(fact.id, fact.key, fact.verifier, fact.namespace));
    return fact;
  }

  invalidate(id: MemoryId, reason: string, contradictionId?: string): VerifiedFact | null {
    const existing = this._facts.get(id);
    if (!existing || existing.invalidatedAt) return null;

    const invalidated: VerifiedFact = Object.freeze({
      ...existing,
      invalidatedAt: this._clock.now(),
      invalidatedBy: contradictionId,
    });

    this._facts.set(id, invalidated);
    this._events.append(factInvalidatedEvent(id, reason, contradictionId));
    return invalidated;
  }

  getById(id: MemoryId): VerifiedFact | undefined {
    return this._facts.get(id);
  }

  /** Returns the most recent valid (non-invalidated) fact for a key+namespace. */
  getByKey(key: string, namespace: Namespace): VerifiedFact | undefined {
    let latest: VerifiedFact | undefined;
    for (const f of this._facts.values()) {
      if (f.key === key && f.namespace === namespace && !f.invalidatedAt) {
        if (!latest || f.verifiedAt > latest.verifiedAt) latest = f;
      }
    }
    return latest;
  }

  listNamespace(namespace: Namespace, includeInvalidated = false): readonly VerifiedFact[] {
    return [...this._facts.values()].filter(
      (f) => f.namespace === namespace && (includeInvalidated || !f.invalidatedAt)
    );
  }

  listAll(includeInvalidated = false): readonly VerifiedFact[] {
    return [...this._facts.values()].filter(
      (f) => includeInvalidated || !f.invalidatedAt
    );
  }

  has(id: MemoryId): boolean { return this._facts.has(id); }
  get size(): number { return this._facts.size; }
}
