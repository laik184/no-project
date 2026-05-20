/**
 * memory-indexer.ts
 *
 * High-level API for indexing new memories into the vector store.
 * Handles deduplication, embedding generation, and category assignment.
 */

import { storeMemory }         from "./pgvector-store.ts";
import { generateEmbedding }   from "../vector/embedding-engine.ts";
import { semanticSearch }      from "../vector/semantic-search.ts";
import { cacheMemory }         from "../vector/semantic-search.ts";
import { buildRunSummary }     from "../vector/context-builder.ts";
import type { MemoryEntry, MemoryCategory } from "../vector/vector-types.ts";

// ── Deduplication threshold ───────────────────────────────────────────────────

const DEDUP_THRESHOLD = 0.95;

// ── Auto category inference ───────────────────────────────────────────────────

function inferCategory(content: string): MemoryCategory {
  const lower = content.toLowerCase();
  if (/error|exception|crash|fail|bug|traceback/.test(lower))  return "failure";
  if (/success|fixed|resolved|working|deployed/.test(lower))   return "success";
  if (/always|never|prefer|use|avoid/.test(lower))             return "preference";
  if (/architecture|design|pattern|structure/.test(lower))     return "architecture";
  if (/install|package|npm|yarn|version|dependency/.test(lower)) return "dependency";
  if (/runtime|process|port|server|pid/.test(lower))           return "runtime";
  if (/because|fact|note|remember/.test(lower))                return "fact";
  return "pattern";
}

// ── Indexer ───────────────────────────────────────────────────────────────────

export interface IndexOptions {
  content:    string;
  category?:  MemoryCategory;
  projectId?: number;
  context?:   string;
  tags?:      string[];
  score?:     number;
  skipDedup?: boolean;
  existing?:  MemoryEntry[];   // pre-loaded pool for dedup check
}

export async function indexMemory(opts: IndexOptions): Promise<{
  id: string;
  isDuplicate: boolean;
  existing?: MemoryEntry;
}> {
  const category = opts.category ?? inferCategory(opts.content);

  // Deduplication check
  if (!opts.skipDedup && opts.existing && opts.existing.length > 0) {
    const dupes = await semanticSearch(opts.existing, {
      query:      opts.content,
      projectId:  opts.projectId,
      categories: [category],
      topK:       1,
      minScore:   DEDUP_THRESHOLD,
    });

    if (dupes.length > 0) {
      return { id: dupes[0].memory.id!, isDuplicate: true, existing: dupes[0].memory };
    }
  }

  // Generate embedding
  const embedded = await generateEmbedding(opts.content);

  const entry: MemoryEntry = {
    projectId:   opts.projectId,
    category,
    content:     opts.content,
    context:     opts.context,
    tags:        opts.tags ?? [],
    score:       opts.score ?? 1.0,
    usedCount:   0,
    embedding:   embedded.embedding,
    createdAt:   Date.now(),
    lastUsedAt:  Date.now(),
  };

  const id = await storeMemory(entry);
  entry.id = id;
  cacheMemory(entry);

  console.log(`[memory-indexer] Stored: ${category} — "${opts.content.slice(0, 60)}..."`);
  return { id, isDuplicate: false };
}

// ── Batch indexer ─────────────────────────────────────────────────────────────

export async function indexRunLearnings(
  goal:      string,
  outcome:   "success" | "failure",
  keyActions:string[],
  errors:    string[],
  projectId: number,
): Promise<string[]> {
  const ids: string[] = [];

  // Store run summary
  const summary = buildRunSummary(goal, outcome, keyActions, errors);
  const category: MemoryCategory = outcome === "success" ? "success" : "failure";
  const r1 = await indexMemory({ content: summary, category, projectId, tags: ["run-summary"] });
  if (!r1.isDuplicate) ids.push(r1.id);

  // Store individual errors as failure memories
  for (const err of errors.slice(0, 3)) {
    const r = await indexMemory({
      content:   err,
      category:  "failure",
      projectId,
      tags:      ["error"],
      skipDedup: false,
    });
    if (!r.isDuplicate) ids.push(r.id);
  }

  // Store successful patterns
  if (outcome === "success") {
    for (const action of keyActions.slice(0, 3)) {
      const r = await indexMemory({
        content:   action,
        category:  "pattern",
        projectId,
        tags:      ["action"],
        skipDedup: false,
      });
      if (!r.isDuplicate) ids.push(r.id);
    }
  }

  return ids;
}
