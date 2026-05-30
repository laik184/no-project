/**
 * server/agents/executor/learning/learning-store.ts
 *
 * Bounded in-process learning storage.
 * Single source of truth for all learned intelligence.
 * No external deps — deterministic, versioned, corruption-safe.
 */

import { memoryEngine } from '../../../memory/core/memory-engine.ts';

// ── Entry types ───────────────────────────────────────────────────────────────

export type LearnedKind =
  | 'tool-reliability'
  | 'strategy-weight'
  | 'workflow-risk'
  | 'browser-pattern'
  | 'failure-prediction'
  | 'execution-quality';

export interface LearnedEntry {
  readonly id:          string;
  readonly kind:        LearnedKind;
  readonly key:         string;
  value:                number;   // primary score [0, 1] unless noted
  evidence:             number;   // number of observations
  lastUpdated:          number;   // epoch ms
  version:              number;   // mutation counter
  metadata?:            Record<string, string | number | boolean>;
}

export interface LearningStoreSummary {
  totalEntries:  number;
  byKind:        Record<LearnedKind, number>;
  oldestEntryMs: number;
  newestEntryMs: number;
  version:       number;
}

// ── Limits ────────────────────────────────────────────────────────────────────

const MAX_ENTRIES      = 1_000;
const PRUNE_TO         = 800;
const MIN_VALUE        = 0.0;
const MAX_VALUE        = 1.0;

// ── Internal store ────────────────────────────────────────────────────────────

const _store   = new Map<string, LearnedEntry>();
let   _seq     = 0;
let   _version = 0;

function _makeId(): string { return `ls_${++_seq}`; }

function _compositeKey(kind: LearnedKind, key: string): string {
  return `${kind}::${key}`;
}

function _prune(): void {
  if (_store.size < MAX_ENTRIES) return;
  // Evict oldest, lowest-evidence entries first
  const sorted = [..._store.entries()].sort((a, b) => {
    const ageDiff = a[1].lastUpdated - b[1].lastUpdated;
    if (ageDiff !== 0) return ageDiff;
    return a[1].evidence - b[1].evidence;
  });
  const evict = sorted.slice(0, _store.size - PRUNE_TO);
  for (const [k] of evict) _store.delete(k);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const learningStore = {
  /**
   * Upsert a learned value. Delta is applied to existing value (bounded).
   * Creates entry if not present, updates if present.
   */
  upsert(
    kind:      LearnedKind,
    key:       string,
    delta:     number,
    metadata?: Record<string, string | number | boolean>,
  ): LearnedEntry {
    const ck = _compositeKey(kind, key);
    const existing = _store.get(ck);
    const now = Date.now();

    if (existing) {
      const proposed = existing.value + delta;
      existing.value       = Math.min(MAX_VALUE, Math.max(MIN_VALUE, proposed));
      existing.evidence   += 1;
      existing.lastUpdated = now;
      existing.version    += 1;
      if (metadata) Object.assign(existing.metadata ??= {}, metadata);
      _version++;

      // Write-through: persist updated entry to long-term memory (fire-and-forget)
      memoryEngine.store({
        category: 'learning',
        content:  JSON.stringify({ kind, key, value: existing.value, evidence: existing.evidence, version: existing.version, metadata: existing.metadata }),
        tags:     [kind, key.split('::')[0]],
        score:    existing.value,
        meta:     { agentSource: 'executor-learning-store', kind, key },
      }).catch(console.error);

      return existing;
    }

    _prune();
    const seed = Math.min(MAX_VALUE, Math.max(MIN_VALUE, 0.5 + delta));
    const entry: LearnedEntry = {
      id:          _makeId(),
      kind,
      key,
      value:       seed,
      evidence:    1,
      lastUpdated: now,
      version:     1,
      metadata,
    };
    _store.set(ck, entry);
    _version++;

    // Write-through: persist new entry to long-term memory (fire-and-forget)
    memoryEngine.store({
      category: 'learning',
      content:  JSON.stringify({ kind, key, value: entry.value, evidence: 1, version: 1, metadata }),
      tags:     [kind, key.split('::')[0]],
      score:    entry.value,
      meta:     { agentSource: 'executor-learning-store', kind, key },
    }).catch(console.error);

    return entry;
  },

  /** Read a single entry. Returns undefined if not found. */
  get(kind: LearnedKind, key: string): LearnedEntry | undefined {
    return _store.get(_compositeKey(kind, key));
  },

  /** Get value, with a default if not found. */
  getValue(kind: LearnedKind, key: string, defaultValue = 0.5): number {
    return _store.get(_compositeKey(kind, key))?.value ?? defaultValue;
  },

  /** All entries for a kind. */
  byKind(kind: LearnedKind): LearnedEntry[] {
    return [..._store.values()].filter(e => e.kind === kind);
  },

  /** Top-N entries for a kind sorted by value descending. */
  topByKind(kind: LearnedKind, n = 5): LearnedEntry[] {
    return this.byKind(kind)
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  },

  summary(): LearningStoreSummary {
    const entries = [..._store.values()];
    const byKind = {} as Record<LearnedKind, number>;
    for (const e of entries) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    const timestamps = entries.map(e => e.lastUpdated);
    return {
      totalEntries:  _store.size,
      byKind,
      oldestEntryMs: timestamps.length ? Math.min(...timestamps) : 0,
      newestEntryMs: timestamps.length ? Math.max(...timestamps) : 0,
      version:       _version,
    };
  },

  /**
   * Hydrate the in-process learning store from persisted entries loaded at startup.
   * Idempotent: skips if the store already has entries.
   * Returns the number of entries restored.
   */
  hydrate(entries: LearnedEntry[]): number {
    if (_store.size > 0) return 0;         // already populated — skip
    if (entries.length === 0) return 0;

    for (const e of entries) {
      const ck = _compositeKey(e.kind, e.key);
      _store.set(ck, { ...e });

      // Advance counters past restored state
      const seq = parseInt(String(e.id).replace('ls_', ''), 10);
      if (!isNaN(seq) && seq > _seq) _seq = seq;
      if (e.version > _version) _version = e.version;
    }

    return _store.size;
  },

  /** Hard reset — testing / governance rollback only. */
  reset(): void {
    _store.clear();
    _seq     = 0;
    _version = 0;
  },

  size():    number { return _store.size; },
  version(): number { return _version;   },
};
