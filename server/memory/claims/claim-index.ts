/**
 * server/memory/claims/claim-index.ts
 *
 * ClaimIndex — secondary indexes over ClaimStore for efficient retrieval.
 * Derived view — always reads from ClaimStore as source of truth.
 */

import type { AgentClaim, ClaimStatus, Namespace } from "../contracts/types.ts";
import type { ClaimStore } from "./claim-store.ts";

export class ClaimIndex {
  constructor(private readonly _store: ClaimStore) {}

  /** Active (unverified, non-expired) claims for a namespace, sorted by confidence desc. */
  activeByConfidence(namespace: Namespace, limit = 50): readonly AgentClaim[] {
    return this._store
      .listByStatus("unverified", namespace)
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /** Most recently created claims for a namespace. */
  recentClaims(namespace: Namespace, limit = 20): readonly AgentClaim[] {
    return this._store
      .listNamespace(namespace)
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /** Claims by run — useful for contradiction scanning within a run. */
  byRun(sourceRunId: string): readonly AgentClaim[] {
    return this._store.listAll().filter((c) => c.sourceRunId === sourceRunId);
  }

  /**
   * Find claims that overlap with a given key/topic (simple substring match).
   * Used by ContradictionDetector to find conflicting claims before promotion.
   */
  overlapping(topic: string, namespace: Namespace, status?: ClaimStatus): readonly AgentClaim[] {
    const lower = topic.toLowerCase();
    const base = status
      ? this._store.listByStatus(status, namespace)
      : this._store.listNamespace(namespace);
    return base.filter((c) => c.claim.toLowerCase().includes(lower));
  }

  /** All distinct namespaces with at least one claim. */
  namespaces(): readonly Namespace[] {
    return Object.freeze([...new Set(this._store.listAll().map((c) => c.namespace))]);
  }

  /** Count by status within a namespace. */
  countByStatus(namespace: Namespace): Record<ClaimStatus, number> {
    const all = this._store.listNamespace(namespace);
    return {
      unverified:   all.filter((c) => c.verificationStatus === "unverified").length,
      verified:     all.filter((c) => c.verificationStatus === "verified").length,
      contradicted: all.filter((c) => c.verificationStatus === "contradicted").length,
      expired:      all.filter((c) => c.verificationStatus === "expired").length,
    };
  }
}
