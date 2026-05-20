/**
 * vector-types.ts
 *
 * Canonical type contracts for the semantic memory engine.
 * Used by embedding-engine, semantic-search, pgvector-store, etc.
 */

export type MemoryCategory =
  | "pattern"       // recurring code patterns
  | "fact"          // established facts about the project
  | "preference"    // user/project preferences
  | "failure"       // things that failed + how
  | "success"       // successful strategies
  | "architecture"  // design decisions
  | "dependency"    // package/library knowledge
  | "runtime";      // runtime incidents + fixes

export interface MemoryEntry {
  id?:        string;           // UUID, assigned on store
  projectId?: number;           // null = global/cross-project
  category:   MemoryCategory;
  content:    string;           // the memory text
  context?:   string;           // surrounding context
  tags:       string[];
  score:      number;           // 0.0–1.0, quality/relevance weight
  usedCount:  number;           // times retrieved
  createdAt:  number;
  lastUsedAt: number;

  // Set after embedding
  embedding?: number[];
}

export interface EmbeddingResult {
  content:   string;
  embedding: number[];          // 1536-dim for text-embedding-3-small
  tokens:    number;
}

export interface SearchOptions {
  query:       string;
  projectId?:  number;          // scope to project (null = global)
  categories?: MemoryCategory[];
  topK:        number;
  minScore:    number;          // cosine similarity threshold
  maxAgeMs?:   number;          // exclude memories older than this
}

export interface RankedMemory {
  memory:        MemoryEntry;
  similarity:    number;        // cosine similarity 0.0–1.0
  recencyScore:  number;        // time-decay adjusted 0.0–1.0
  usageScore:    number;        // usage frequency boost 0.0–1.0
  finalScore:    number;        // weighted combination
  relevanceNote: string;        // why this was retrieved
}

export interface VectorStoreStats {
  total:        number;
  byCategory:   Record<MemoryCategory, number>;
  avgScore:     number;
  oldestMs:     number;
  newestMs:     number;
}

/** Embedding model to use via OpenRouter. */
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
/** Dimension of the embedding vectors. */
export const EMBEDDING_DIM   = 1536;

/** Weights for final score computation. */
export const SCORE_WEIGHTS = {
  similarity: 0.60,
  recency:    0.25,
  usage:      0.15,
} as const;
