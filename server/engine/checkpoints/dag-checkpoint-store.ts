/**
 * dag-checkpoint-store.ts
 *
 * Persistent ring-buffer checkpoint store for DAG execution.
 * Survives within-process restarts via module-level singleton.
 * Max 50 checkpoints across all runs (evicts oldest on overflow).
 *
 * Single responsibility: checkpoint CRUD + eviction. No execution logic.
 */

import type { GraphCheckpoint } from "../graph/graph-state.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CheckpointEntry {
  checkpointId: string;
  runId:        string;
  projectId:    number;
  savedAt:      number;
  checkpoint:   GraphCheckpoint;
}

export interface CheckpointQuery {
  runId?:     string;
  projectId?: number;
}

// ── Ring-buffer store ─────────────────────────────────────────────────────────

const MAX_ENTRIES = 50;

class DagCheckpointStore {
  private entries: CheckpointEntry[] = [];   // insertion-ordered
  private byKey   = new Map<string, CheckpointEntry>(); // key = runId:checkpointAt

  private key(runId: string, nodeId: string): string {
    return `${runId}:${nodeId}`;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  save(runId: string, projectId: number, checkpoint: GraphCheckpoint): string {
    const k   = this.key(runId, checkpoint.checkpointAt);
    const id  = k;

    // Upsert
    if (this.byKey.has(k)) {
      const existing = this.byKey.get(k)!;
      existing.checkpoint = checkpoint;
      existing.savedAt    = Date.now();
      return id;
    }

    const entry: CheckpointEntry = {
      checkpointId: id,
      runId,
      projectId,
      savedAt:    Date.now(),
      checkpoint,
    };

    this.entries.push(entry);
    this.byKey.set(k, entry);

    // Evict oldest if over limit
    if (this.entries.length > MAX_ENTRIES) {
      const evicted = this.entries.shift()!;
      this.byKey.delete(this.key(evicted.runId, evicted.checkpoint.checkpointAt));
      console.log(`[dag-checkpoint-store] Evicted checkpoint ${evicted.checkpointId}`);
    }

    console.log(`[dag-checkpoint-store] Saved checkpoint ${id} (${this.entries.length}/${MAX_ENTRIES})`);
    return id;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /** Load the most recent checkpoint for a given runId. */
  loadLatest(runId: string): GraphCheckpoint | undefined {
    const forRun = this.entries
      .filter(e => e.runId === runId)
      .sort((a, b) => b.savedAt - a.savedAt);
    return forRun[0]?.checkpoint;
  }

  /** Load checkpoint at a specific nodeId for a run. */
  loadAt(runId: string, checkpointAt: string): GraphCheckpoint | undefined {
    return this.byKey.get(this.key(runId, checkpointAt))?.checkpoint;
  }

  /** List all checkpoints for a run (newest first). */
  listForRun(runId: string): CheckpointEntry[] {
    return this.entries
      .filter(e => e.runId === runId)
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  /** List all checkpoints for a project. */
  listForProject(projectId: number): CheckpointEntry[] {
    return this.entries
      .filter(e => e.projectId === projectId)
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  /** Delete all checkpoints for a run (on run completion/eviction). */
  evictRun(runId: string): number {
    const before = this.entries.length;
    const toEvict = this.entries.filter(e => e.runId === runId);
    for (const e of toEvict) {
      this.byKey.delete(this.key(e.runId, e.checkpoint.checkpointAt));
    }
    this.entries = this.entries.filter(e => e.runId !== runId);
    return before - this.entries.length;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  snapshot(): { total: number; maxEntries: number; runCount: number } {
    const runIds = new Set(this.entries.map(e => e.runId));
    return { total: this.entries.length, maxEntries: MAX_ENTRIES, runCount: runIds.size };
  }
}

// Singleton — module-level
export const dagCheckpointStore = new DagCheckpointStore();
