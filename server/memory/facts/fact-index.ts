/**
 * server/memory/facts/fact-index.ts
 *
 * FactIndex — secondary indexes over FactStore for fast multi-dimensional lookup.
 * Rebuilt on demand by scanning the store — no persistent state of its own.
 * Always read FactStore as source of truth; index is a derived view.
 */

import type { VerifiedFact, Namespace } from "../contracts/types.ts";
import type { FactStore } from "./fact-store.ts";

export type FactsByKey      = Map<string, VerifiedFact[]>;
export type FactsByVerifier = Map<string, VerifiedFact[]>;

export class FactIndex {
  constructor(private readonly _store: FactStore) {}

  /** All valid facts keyed by their `key` field within a namespace. */
  byKey(namespace: Namespace): FactsByKey {
    const index: FactsByKey = new Map();
    for (const fact of this._store.listNamespace(namespace)) {
      const bucket = index.get(fact.key) ?? [];
      bucket.push(fact);
      index.set(fact.key, bucket);
    }
    return index;
  }

  /** All valid facts grouped by their verifier. */
  byVerifier(namespace: Namespace): FactsByVerifier {
    const index: FactsByVerifier = new Map();
    for (const fact of this._store.listNamespace(namespace)) {
      const bucket = index.get(fact.verifier) ?? [];
      bucket.push(fact);
      index.set(fact.verifier, bucket);
    }
    return index;
  }

  /**
   * Returns keys that have more than one valid fact (possible conflict).
   * Used by ContradictionDetector to find stale duplicates.
   */
  duplicateKeys(namespace: Namespace): readonly string[] {
    const byKey = this.byKey(namespace);
    const dups: string[] = [];
    for (const [key, facts] of byKey) {
      if (facts.length > 1) dups.push(key);
    }
    return Object.freeze(dups);
  }

  /**
   * Returns the most recently verified fact for each key.
   * Provides a clean, deduplicated snapshot.
   */
  latest(namespace: Namespace): ReadonlyMap<string, VerifiedFact> {
    const byKey = this.byKey(namespace);
    const result = new Map<string, VerifiedFact>();
    for (const [key, facts] of byKey) {
      const sorted = [...facts].sort((a, b) => b.verifiedAt - a.verifiedAt);
      result.set(key, sorted[0]);
    }
    return result;
  }

  /** All distinct namespaces present in the store. */
  namespaces(): readonly Namespace[] {
    return Object.freeze([...new Set(this._store.listAll().map((f) => f.namespace))]);
  }
}
