/**
 * server/memory/compression/archiver.ts
 *
 * Purpose: Archive low-value or stale entries to reduce store bloat.
 * Responsibility: Identify archival candidates by age, score, and TTL.
 *   Move candidates to a JSON archive file; remove from active store.
 * Exports: Archiver, archiver (singleton)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { MemoryEntry, MemoryCategory } from '../types/memory.types.ts';
import { memoryRegistry } from '../core/memory-registry.ts';

const ARCHIVE_DIR = join(process.cwd(), '.data', 'memory', 'archive');

function ensureDir(): void {
  if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });
}

function archivePath(category: MemoryCategory): string {
  return join(ARCHIVE_DIR, `${category}.json`);
}

function loadArchive(category: MemoryCategory): MemoryEntry[] {
  try {
    const p = archivePath(category);
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, 'utf8')) as MemoryEntry[];
  } catch { return []; }
}

function saveArchive(category: MemoryCategory, entries: MemoryEntry[]): void {
  ensureDir();
  writeFileSync(archivePath(category), JSON.stringify(entries, null, 0), 'utf8');
}

// ── Archiver ──────────────────────────────────────────────────────────────────

export interface ArchiveReport {
  category:  MemoryCategory;
  archived:  number;
  remaining: number;
}

export class Archiver {

  /**
   * Archive entries from a category that match the criteria.
   * Criteria: score < minScore OR older than maxAgeMs.
   */
  async archiveCategory(
    category: MemoryCategory,
    options: {
      minScore?: number;
      maxAgeMs?: number;
    } = {},
  ): Promise<ArchiveReport> {
    const minScore = options.minScore ?? 0.3;
    const maxAgeMs = options.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000;  // 30 days
    const cutoff   = Date.now() - maxAgeMs;

    const store   = memoryRegistry.get(category);
    const all     = await store.list();
    const candidates = all.filter(
      e => e.score < minScore || e.createdAt < cutoff,
    );

    if (candidates.length === 0) {
      return { category, archived: 0, remaining: all.length };
    }

    // Append to archive file
    const existing = loadArchive(category);
    saveArchive(category, [...existing, ...candidates]);

    // Remove from active store
    await Promise.all(candidates.map(e => store.delete(e.id)));

    return {
      category,
      archived:  candidates.length,
      remaining: all.length - candidates.length,
    };
  }

  /** Load archived entries for a category. */
  loadArchive(category: MemoryCategory): MemoryEntry[] {
    return loadArchive(category);
  }

  /** Count archived entries across all categories. */
  async totalArchived(): Promise<number> {
    const categories = memoryRegistry.categories();
    return categories.reduce((sum, cat) => sum + loadArchive(cat).length, 0);
  }
}

export const archiver = new Archiver();
