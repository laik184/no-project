/**
 * server/memory/compression/clusterer.ts
 *
 * Purpose: Group memory entries into semantic clusters by content similarity.
 * Responsibility: K-means–style greedy clustering on TF-IDF term vectors.
 *   Produces cluster labels for downstream archival decisions.
 * Exports: Clusterer, clusterer (singleton)
 */

import type { MemoryEntry } from '../types/memory.types.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Cluster {
  id:       number;
  centroid: string[];   // top representative terms
  entries:  string[];   // entry ids
  size:     number;
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf  = new Map<string, number>();
  const len = Math.max(tokens.length, 1);
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1 / len);
  return tf;
}

function overlap(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [t, w] of a) dot += w * (b.get(t) ?? 0);
  return dot;
}

// ── Clusterer ─────────────────────────────────────────────────────────────────

export class Clusterer {

  /**
   * Greedily assign entries to clusters based on content similarity.
   * Entries with cosine overlap > threshold are merged into the same cluster.
   */
  cluster(entries: MemoryEntry[], threshold = 0.2): Cluster[] {
    if (entries.length === 0) return [];

    const vectors = entries.map(e => ({
      id:  e.id,
      vec: termFreq(tokenize(e.content)),
    }));

    const clusters: Array<{ ids: string[]; centroid: Map<string, number> }> = [];

    for (const v of vectors) {
      let best     = -1;
      let bestSim  = threshold;

      for (let i = 0; i < clusters.length; i++) {
        const sim = overlap(v.vec, clusters[i].centroid);
        if (sim > bestSim) { bestSim = sim; best = i; }
      }

      if (best === -1) {
        // New cluster
        clusters.push({ ids: [v.id], centroid: new Map(v.vec) });
      } else {
        // Merge into existing
        clusters[best].ids.push(v.id);
        for (const [t, w] of v.vec) {
          const prev = clusters[best].centroid.get(t) ?? 0;
          clusters[best].centroid.set(t, (prev + w) / 2);
        }
      }
    }

    return clusters.map((c, i) => {
      const topTerms = [...c.centroid.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t]) => t);
      return { id: i, centroid: topTerms, entries: c.ids, size: c.ids.length };
    });
  }
}

export const clusterer = new Clusterer();
