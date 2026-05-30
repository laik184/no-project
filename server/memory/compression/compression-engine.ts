/**
 * server/memory/compression/compression-engine.ts
 *
 * Purpose: Orchestrates summarisation, clustering, and archival passes.
 * Responsibility: Run full compression cycles across the memory platform.
 *   Coordinates summarizer, clusterer, and archiver; does not duplicate logic.
 * Exports: CompressionEngine, compressionEngine (singleton)
 */

import { memoryRegistry }   from '../core/memory-registry.ts';
import { summarizer }       from './summarizer.ts';
import { clusterer }        from './clusterer.ts';
import { archiver }         from './archiver.ts';
import type { MemoryCategory } from '../types/memory.types.ts';
import type { Cluster }        from './clusterer.ts';
import type { ArchiveReport }  from './archiver.ts';
import type { SummaryResult }  from './summarizer.ts';

export interface CompressionReport {
  categories:   MemoryCategory[];
  archives:     ArchiveReport[];
  clusters:     Cluster[];
  summary:      SummaryResult;
  durationMs:   number;
  totalSaved:   number;
}

export class CompressionEngine {

  /**
   * Run a full compression pass across all (or specified) categories.
   * 1. Archive low-value / stale entries.
   * 2. Cluster remaining entries.
   * 3. Summarise each cluster.
   */
  async compress(options: {
    categories?: MemoryCategory[];
    minScore?:   number;
    maxAgeMs?:   number;
  } = {}): Promise<CompressionReport> {
    const start      = Date.now();
    const categories = options.categories ?? memoryRegistry.categories();

    // ── Phase 1: Archive ───────────────────────────────────────────────────
    const archives = await Promise.all(
      categories.map(cat =>
        archiver.archiveCategory(cat, {
          minScore: options.minScore,
          maxAgeMs: options.maxAgeMs,
        }),
      ),
    );

    const totalSaved = archives.reduce((s, r) => s + r.archived, 0);

    // ── Phase 2: Cluster remaining entries ─────────────────────────────────
    const remaining = await Promise.all(
      categories.map(cat => memoryRegistry.get(cat).list()),
    );
    const allEntries = remaining.flat();
    const clusters   = clusterer.cluster(allEntries);

    // ── Phase 3: Summarise all remaining entries ────────────────────────────
    const summary = summarizer.summarise(allEntries);

    return {
      categories,
      archives,
      clusters,
      summary,
      durationMs: Date.now() - start,
      totalSaved,
    };
  }

  /** Summarise a specific category. */
  async summariseCategory(category: MemoryCategory): Promise<SummaryResult> {
    const entries = await memoryRegistry.get(category).list();
    return summarizer.summarise(entries);
  }
}

export const compressionEngine = new CompressionEngine();
