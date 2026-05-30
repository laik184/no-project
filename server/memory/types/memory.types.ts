/**
 * server/memory/types/memory.types.ts
 *
 * Purpose: Core type contracts for the memory platform.
 * Responsibility: Define all shared base interfaces. No runtime logic.
 * Exports: MemoryCategory, MemoryEntry, MemoryStore, MemoryFilter
 */

// ── Category registry ─────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'decision'
  | 'architecture'
  | 'bug'
  | 'business'
  | 'user-feedback'
  | 'revenue'
  | 'learning'
  | 'prediction'
  | 'execution'
  | 'conversation'
  | 'reflection'
  | 'checkpoint';

// ── Base entry ────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  readonly id:       string;
  readonly category: MemoryCategory;
  content:           string;
  tags:              string[];
  /** Quality / confidence score: 0.0–1.0 */
  score:             number;
  createdAt:         number;   // Unix ms
  updatedAt:         number;   // Unix ms
  /** Optional TTL in ms. Entry is considered stale after createdAt + ttlMs. */
  ttlMs?:            number;
  meta:              Record<string, unknown>;
}

// ── Entry creation input ──────────────────────────────────────────────────────

export interface CreateEntryInput {
  id?:       string;
  category:  MemoryCategory;
  content:   string;
  tags?:     string[];
  score?:    number;
  ttlMs?:    number;
  meta?:     Record<string, unknown>;
}

// ── Entry update patch ────────────────────────────────────────────────────────

export interface UpdateEntryPatch {
  content?:  string;
  tags?:     string[];
  score?:    number;
  ttlMs?:    number;
  meta?:     Record<string, unknown>;
}

// ── Filter for list/search ────────────────────────────────────────────────────

export interface MemoryFilter {
  category?:    MemoryCategory;
  tags?:        string[];
  minScore?:    number;
  maxScore?:    number;
  after?:       number;   // createdAt >=
  before?:      number;   // createdAt <=
  excludeStale?: boolean;
  limit?:       number;
  offset?:      number;
}

// ── Store contract ────────────────────────────────────────────────────────────

export interface MemoryStore<T extends MemoryEntry = MemoryEntry> {
  readonly category: MemoryCategory;
  create(input: CreateEntryInput):          Promise<T>;
  get(id: string):                          Promise<T | undefined>;
  update(id: string, patch: UpdateEntryPatch): Promise<T | undefined>;
  delete(id: string):                       Promise<boolean>;
  list(filter?: MemoryFilter):              Promise<T[]>;
  search(query: string, limit?: number):    Promise<T[]>;
  count():                                  Promise<number>;
  clear():                                  Promise<void>;
}

// ── Bulk operation result ─────────────────────────────────────────────────────

export interface BulkResult {
  succeeded: number;
  failed:    number;
  errors:    string[];
}
