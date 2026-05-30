/**
 * server/memory/checkpoints/checkpoint-store.ts
 *
 * Purpose: File-based persistence for memory snapshots.
 * Responsibility: Save, load, list, and delete checkpoint files.
 *   Each checkpoint is one JSON file in .data/memory/checkpoints/.
 * Exports: CheckpointStore, checkpointStore (singleton)
 */

import {
  readFileSync, writeFileSync, readdirSync,
  unlinkSync, mkdirSync, existsSync,
} from 'fs';
import { join } from 'path';
import type { MemorySnapshot } from './snapshot-builder.ts';

const CHECKPOINT_DIR = join(process.cwd(), '.data', 'memory', 'checkpoints');

function ensureDir(): void {
  if (!existsSync(CHECKPOINT_DIR)) mkdirSync(CHECKPOINT_DIR, { recursive: true });
}

function snapshotPath(id: string): string {
  return join(CHECKPOINT_DIR, `${id}.json`);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export interface CheckpointMeta {
  id:        string;
  label:     string;
  createdAt: number;
  entryCount: number;
}

export class CheckpointStore {

  save(snapshot: MemorySnapshot): void {
    ensureDir();
    writeFileSync(
      snapshotPath(snapshot.id),
      JSON.stringify(snapshot, null, 0),
      'utf8',
    );
  }

  load(id: string): MemorySnapshot | undefined {
    try {
      const raw = readFileSync(snapshotPath(id), 'utf8');
      return JSON.parse(raw) as MemorySnapshot;
    } catch { return undefined; }
  }

  list(): CheckpointMeta[] {
    ensureDir();
    const files = readdirSync(CHECKPOINT_DIR).filter(f => f.endsWith('.json'));
    return files
      .map(f => {
        try {
          const snap = JSON.parse(
            readFileSync(join(CHECKPOINT_DIR, f), 'utf8'),
          ) as MemorySnapshot;
          return {
            id:        snap.id,
            label:     snap.label,
            createdAt: snap.createdAt,
            entryCount: snap.meta.totalEntries,
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b!.createdAt - a!.createdAt) as CheckpointMeta[];
  }

  delete(id: string): boolean {
    try {
      unlinkSync(snapshotPath(id));
      return true;
    } catch { return false; }
  }

  latest(): MemorySnapshot | undefined {
    const metas = this.list();
    if (metas.length === 0) return undefined;
    return this.load(metas[0].id);
  }
}

export const checkpointStore = new CheckpointStore();
