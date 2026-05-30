/**
 * server/memory/core/memory-store.ts
 *
 * Purpose: Abstract base class for all domain memory stores.
 * Responsibility: Shared CRUD, persistence, TTL eviction, and text search.
 *   Domain stores extend this — no duplicated logic.
 * Exports: BaseMemoryStore
 */

import { randomUUID }       from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join }             from 'path';
import type {
  MemoryEntry,
  MemoryCategory,
  MemoryStore,
  MemoryFilter,
  CreateEntryInput,
  UpdateEntryPatch,
} from '../types/memory.types.ts';

const DATA_ROOT = join(process.cwd(), '.data', 'memory');

function ensureDataDir(category: string): string {
  const dir = join(DATA_ROOT, category);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function keywordScore(query: string, entry: MemoryEntry): number {
  const qTerms  = new Set(tokenize(query));
  const eTerms  = tokenize(`${entry.content} ${entry.tags.join(' ')}`);
  if (qTerms.size === 0) return 0;
  const matched = eTerms.filter(t => qTerms.has(t)).length;
  return Math.min(matched / qTerms.size, 1);
}

// ── Abstract base store ───────────────────────────────────────────────────────

export abstract class BaseMemoryStore<T extends MemoryEntry>
  implements MemoryStore<T> {

  readonly category: MemoryCategory;
  protected readonly store = new Map<string, T>();

  constructor(category: MemoryCategory) {
    this.category = category;
    this.load();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  protected buildEntry(input: CreateEntryInput, extra: Partial<T> = {}): T {
    const now = Date.now();
    return {
      id:        input.id ?? randomUUID(),
      category:  input.category,
      content:   input.content,
      tags:      input.tags ?? [],
      score:     input.score ?? 0.5,
      createdAt: now,
      updatedAt: now,
      ttlMs:     input.ttlMs,
      meta:      input.meta ?? {},
      ...extra,
    } as T;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(input: CreateEntryInput): Promise<T> {
    const entry = this.buildEntry(input);
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async get(id: string): Promise<T | undefined> {
    return this.store.get(id);
  }

  async update(id: string, patch: UpdateEntryPatch): Promise<T | undefined> {
    const existing = this.store.get(id);
    if (!existing) return undefined;
    const updated = {
      ...existing,
      ...patch,
      meta:      { ...existing.meta, ...(patch.meta ?? {}) },
      updatedAt: Date.now(),
    } as T;
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.store.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  async list(filter?: MemoryFilter): Promise<T[]> {
    const now = Date.now();
    let entries = [...this.store.values()];

    if (filter?.excludeStale) {
      entries = entries.filter(e =>
        !e.ttlMs || (e.createdAt + e.ttlMs > now),
      );
    }
    if (filter?.tags && filter.tags.length > 0) {
      const required = new Set(filter.tags);
      entries = entries.filter(e => e.tags.some(t => required.has(t)));
    }
    if (filter?.minScore !== undefined) {
      entries = entries.filter(e => e.score >= filter.minScore!);
    }
    if (filter?.maxScore !== undefined) {
      entries = entries.filter(e => e.score <= filter.maxScore!);
    }
    if (filter?.after !== undefined) {
      entries = entries.filter(e => e.createdAt >= filter.after!);
    }
    if (filter?.before !== undefined) {
      entries = entries.filter(e => e.createdAt <= filter.before!);
    }

    entries.sort((a, b) => b.createdAt - a.createdAt);

    const offset = filter?.offset ?? 0;
    const limit  = filter?.limit  ?? 1000;
    return entries.slice(offset, offset + limit);
  }

  async search(query: string, limit = 20): Promise<T[]> {
    const now = Date.now();
    const scored = [...this.store.values()]
      .filter(e => !e.ttlMs || e.createdAt + e.ttlMs > now)
      .map(e => ({ entry: e, score: keywordScore(query, e) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(r => r.entry);
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.persist();
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  protected persist(): void {
    try {
      const dir  = ensureDataDir(this.category);
      const path = join(dir, 'store.json');
      const data = JSON.stringify([...this.store.values()], null, 0);
      writeFileSync(path, data, 'utf8');
    } catch {
      // persistence failure is non-fatal — in-memory state is authoritative
    }
  }

  protected load(): void {
    try {
      const path = join(DATA_ROOT, this.category, 'store.json');
      if (!existsSync(path)) return;
      const raw     = readFileSync(path, 'utf8');
      const entries = JSON.parse(raw) as T[];
      for (const e of entries) this.store.set(e.id, e);
    } catch {
      // corrupted file — start fresh
    }
  }

  /** Evict all entries whose TTL has expired. */
  evictStale(): number {
    const now  = Date.now();
    let count  = 0;
    for (const [id, e] of this.store) {
      if (e.ttlMs && e.createdAt + e.ttlMs <= now) {
        this.store.delete(id);
        count++;
      }
    }
    if (count > 0) this.persist();
    return count;
  }
}
