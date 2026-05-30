/**
 * server/memory/context/memory-context-builder.ts
 *
 * Phase 6 — Unified Memory Context Builder.
 *
 * Builds a rich, consolidated memory context from:
 *   - Multi-category memory recall (hybrid search)
 *   - Knowledge graph neighbours
 *   - Domain-specific summary statistics
 *
 * Consumed by: Planner, Executor, Verifier, CoderX before reasoning.
 * Never throws — returns empty context on any failure.
 */

import { memoryEngine }    from '../core/memory-engine.ts';
import { graphTraversal }  from '../knowledge-graph/graph-traversal.ts';
import { graphStore }      from '../knowledge-graph/graph-store.ts';
import type { MemoryEntry, MemoryCategory } from '../types/memory.types.ts';
import type { GraphEntity }                 from '../types/graph.types.ts';

// ── Context shape ─────────────────────────────────────────────────────────────

export interface MemoryContext {
  /** Recalled memory entries relevant to the topic */
  entries:       MemoryEntry[];
  /** Graph entities related to the topic */
  graphEntities: GraphEntity[];
  /** Human-readable summary of recalled context */
  summary:       string;
  /** Source topic used for recall */
  topic:         string;
  /** How long the context build took */
  durationMs:    number;
  /** Total entries found across all categories */
  totalFound:    number;
  /** Whether any graph intelligence was found */
  hasGraphData:  boolean;
}

export interface ContextBuildOptions {
  categories?:     MemoryCategory[];
  limit?:          number;
  minScore?:       number;
  graphDepth?:     number;
  maxGraphEntities?: number;
}

// ── Default config ────────────────────────────────────────────────────────────

const DEFAULTS: Required<ContextBuildOptions> = {
  categories:      ['decision', 'architecture', 'bug', 'learning', 'execution', 'reflection'],
  limit:           12,
  minScore:        0.1,
  graphDepth:      2,
  maxGraphEntities: 10,
};

// ── Empty context factory ─────────────────────────────────────────────────────

function emptyContext(topic: string, durationMs = 0): MemoryContext {
  return {
    entries:       [],
    graphEntities: [],
    summary:       'No prior memory context found.',
    topic,
    durationMs,
    totalFound:    0,
    hasGraphData:  false,
  };
}

// ── Graph enrichment ──────────────────────────────────────────────────────────

function _enrichFromGraph(topic: string, limit: number, depth: number): GraphEntity[] {
  try {
    const allEntities = graphStore.listEntities();
    if (allEntities.length === 0) return [];

    // Find entities whose label or description match the topic keywords
    const keywords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (keywords.length === 0) {
      // No keywords — return top entities by recency
      return allEntities
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
    }

    // Score by keyword overlap
    const scored = allEntities.map(e => {
      const text = `${e.label} ${e.description}`.toLowerCase();
      const hits  = keywords.filter(k => text.includes(k)).length;
      return { entity: e, score: hits };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return [];

    // BFS from top matching entity to get neighbourhood context
    const seed  = scored[0].entity;
    const found = graphTraversal.bfs(seed.id, depth);
    const extra = scored.slice(1, 3).flatMap(r => graphTraversal.neighbours(r.entity.id));

    // Deduplicate
    const seen = new Set<string>();
    const out:  GraphEntity[] = [];
    for (const e of [...found, ...extra]) {
      if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

// ── Summary builder ───────────────────────────────────────────────────────────

function _buildSummary(entries: MemoryEntry[], graphEntities: GraphEntity[]): string {
  if (entries.length === 0 && graphEntities.length === 0) {
    return 'No prior memory context found.';
  }

  const parts: string[] = [];

  // Group entries by category
  const byCategory = new Map<MemoryCategory, MemoryEntry[]>();
  for (const e of entries) {
    const arr = byCategory.get(e.category) ?? [];
    arr.push(e);
    byCategory.set(e.category, arr);
  }

  for (const [cat, catEntries] of byCategory) {
    const preview = catEntries
      .slice(0, 2)
      .map(e => e.content.slice(0, 120).replace(/\s+/g, ' '))
      .join(' | ');
    parts.push(`[${cat}:${catEntries.length}] ${preview}`);
  }

  if (graphEntities.length > 0) {
    const entityList = graphEntities
      .slice(0, 5)
      .map(e => `${e.kind}:${e.label}`)
      .join(', ');
    parts.push(`[graph:${graphEntities.length}] ${entityList}`);
  }

  return parts.join('\n');
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Build a unified memory context for the given topic.
 * Always returns a valid MemoryContext — never throws.
 */
export async function buildMemoryContext(
  topic:   string,
  options: ContextBuildOptions = {},
): Promise<MemoryContext> {
  const start = Date.now();
  const opts  = { ...DEFAULTS, ...options };

  if (!topic || !topic.trim()) {
    return emptyContext(topic, Date.now() - start);
  }

  try {
    // ── 1. Hybrid recall across memory categories ──────────────────────────
    const recallResult = await memoryEngine.recall(topic.trim(), {
      categories: opts.categories,
      limit:      opts.limit,
      minScore:   opts.minScore,
    });

    // recall() returns RankedResult<MemoryEntry>[] — extract the entry objects
    const entries = recallResult.results.map((r) => r.entry);

    // ── 2. Knowledge graph enrichment ──────────────────────────────────────
    const graphEntities = _enrichFromGraph(
      topic,
      opts.maxGraphEntities,
      opts.graphDepth,
    );

    // ── 3. Build summary ───────────────────────────────────────────────────
    const summary    = _buildSummary(entries, graphEntities);
    const durationMs = Date.now() - start;

    return {
      entries,
      graphEntities,
      summary,
      topic,
      durationMs,
      totalFound:  entries.length + graphEntities.length,
      hasGraphData: graphEntities.length > 0,
    };
  } catch {
    return emptyContext(topic, Date.now() - start);
  }
}

/**
 * Build a compact memory context string suitable for injecting into prompts.
 * Safe to call from any agent — never throws.
 */
export async function buildMemoryContextString(
  topic:   string,
  options: ContextBuildOptions = {},
): Promise<string> {
  try {
    const ctx = await buildMemoryContext(topic, options);
    if (ctx.totalFound === 0) return '';
    return `--- Memory Context (${ctx.totalFound} records, ${ctx.durationMs}ms) ---\n${ctx.summary}`;
  } catch {
    return '';
  }
}
