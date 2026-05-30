/**
 * server/memory/checkpoints/snapshot-builder.ts
 *
 * Purpose: Serialises the current state of all memory stores into a snapshot.
 * Responsibility: Build a point-in-time snapshot object. Does not write to disk.
 * Exports: SnapshotBuilder, snapshotBuilder (singleton)
 */

import { memoryRegistry }      from '../core/memory-registry.ts';
import { graphStore }          from '../knowledge-graph/graph-store.ts';
import type { MemoryEntry, MemoryCategory } from '../types/memory.types.ts';

// ── Snapshot shape ────────────────────────────────────────────────────────────

export interface MemorySnapshot {
  id:          string;
  createdAt:   number;
  label:       string;
  stores:      Record<MemoryCategory, MemoryEntry[]>;
  graph: {
    entities:      unknown[];
    relationships: unknown[];
  };
  meta: {
    totalEntries:  number;
    categories:    MemoryCategory[];
  };
}

// ── Builder ───────────────────────────────────────────────────────────────────

export class SnapshotBuilder {

  async build(label: string): Promise<MemorySnapshot> {
    const categories = memoryRegistry.categories();
    const stores     = {} as Record<MemoryCategory, MemoryEntry[]>;
    let   total      = 0;

    await Promise.all(
      categories.map(async (cat) => {
        const entries  = await memoryRegistry.get(cat).list();
        stores[cat]    = entries;
        total         += entries.length;
      }),
    );

    const entities      = graphStore.listEntities();
    const relationships = [
      ...entities.flatMap(e => graphStore.relationshipsFrom(e.id)),
    ];
    // Deduplicate relationships by id
    const relMap = new Map(relationships.map(r => [r.id, r]));

    return {
      id:        `snap-${Date.now()}`,
      createdAt: Date.now(),
      label,
      stores,
      graph: {
        entities,
        relationships: [...relMap.values()],
      },
      meta: {
        totalEntries: total,
        categories,
      },
    };
  }
}

export const snapshotBuilder = new SnapshotBuilder();
