/**
 * server/memory/checkpoints/checkpoint-manager.ts
 *
 * Purpose: High-level checkpoint lifecycle: save, rollback, replay.
 * Responsibility: Coordinate snapshot building + store restoration.
 *   Delegates disk I/O to checkpoint-store; entry restoration to each store.
 * Exports: CheckpointManager, checkpointManager (singleton)
 */

import { snapshotBuilder }  from './snapshot-builder.ts';
import { checkpointStore }  from './checkpoint-store.ts';
import { memoryRegistry }   from '../core/memory-registry.ts';
import { graphStore }       from '../knowledge-graph/graph-store.ts';
import type { MemoryCategory, MemoryEntry } from '../types/memory.types.ts';
import type { GraphEntity, GraphRelationship } from '../types/graph.types.ts';
import type { CheckpointMeta } from './checkpoint-store.ts';

export interface CheckpointResult {
  ok:         boolean;
  id?:        string;
  label?:     string;
  entryCount?: number;
  error?:     string;
}

export class CheckpointManager {

  /** Save a named snapshot of the current memory state. */
  async save(label: string): Promise<CheckpointResult> {
    try {
      const snapshot = await snapshotBuilder.build(label);
      checkpointStore.save(snapshot);
      return {
        ok:         true,
        id:         snapshot.id,
        label:      snapshot.label,
        entryCount: snapshot.meta.totalEntries,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  /**
   * Rollback all memory stores to the state captured in a checkpoint.
   * Clears all current entries and replaces with the snapshot data.
   */
  async rollback(checkpointId: string): Promise<CheckpointResult> {
    const snapshot = checkpointStore.load(checkpointId);
    if (!snapshot) {
      return { ok: false, error: `Checkpoint not found: ${checkpointId}` };
    }

    try {
      // Restore memory stores
      await Promise.all(
        (Object.entries(snapshot.stores) as [MemoryCategory, MemoryEntry[]][]).map(
          async ([cat, entries]) => {
            if (!memoryRegistry.has(cat)) return;
            const store = memoryRegistry.get(cat);
            await store.clear();
            await Promise.all(entries.map(e => store.create(e)));
          },
        ),
      );

      // Restore graph
      const entities      = snapshot.graph.entities      as GraphEntity[];
      const relationships = snapshot.graph.relationships as GraphRelationship[];
      for (const e of entities) {
        if (!graphStore.getEntity(e.id)) graphStore.createEntity(e);
      }
      for (const r of relationships) {
        if (!graphStore.getRelationship(r.id)) graphStore.createRelationship(r);
      }

      return {
        ok:         true,
        id:         snapshot.id,
        label:      snapshot.label,
        entryCount: snapshot.meta.totalEntries,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  /** List all available checkpoints, newest first. */
  list(): CheckpointMeta[] {
    return checkpointStore.list();
  }

  /** Delete a checkpoint by id. */
  delete(id: string): boolean {
    return checkpointStore.delete(id);
  }
}

export const checkpointManager = new CheckpointManager();
