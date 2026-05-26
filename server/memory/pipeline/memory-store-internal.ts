/**
 * memory-store-internal.ts
 *
 * In-process memory store and capacity management — extracted from memory-pipeline.ts.
 *
 * Single responsibility: raw store CRUD + capacity enforcement.
 * No pipeline orchestration, no retrieval, no classification here.
 */

import { memoryTelemetry }  from "../telemetry/memory-telemetry.ts";
import type { MemoryEntry } from "../types.ts";

// ── Store ─────────────────────────────────────────────────────────────────────

export const _store = new Map<string, MemoryEntry>();
export const MAX_ENTRIES_PER_PROJECT = 500;

// ── Capacity enforcement ──────────────────────────────────────────────────────

/**
 * Evict lowest-scored entries when a project's lane is at capacity.
 * Eviction rate: 10% of MAX_ENTRIES_PER_PROJECT per overflow event.
 */
export function enforceCapacity(projectId: number): void {
  const projectEntries = [..._store.entries()].filter(([, e]) => e.projectId === projectId);
  if (projectEntries.length < MAX_ENTRIES_PER_PROJECT) return;

  const sorted = projectEntries.sort(
    ([, a], [, b]) => (a.score + a.usedCount * 0.01) - (b.score + b.usedCount * 0.01),
  );
  const toEvict = sorted.slice(0, Math.ceil(MAX_ENTRIES_PER_PROJECT * 0.1));
  for (const [id, entry] of toEvict) {
    _store.delete(id);
    memoryTelemetry.archived({ entryId: id, reason: "overflow", projectId: entry.projectId ?? 0 });
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getProjectEntries(projectId: number): MemoryEntry[] {
  return [..._store.values()].filter((e) => e.projectId === projectId);
}

export function getAllEntries(): MemoryEntry[] {
  return [..._store.values()];
}

export function getStoreStats(): {
  total:      number;
  byCategory: Record<string, number>;
  byProject:  Record<string, number>;
} {
  const entries    = [..._store.values()];
  const byCategory: Record<string, number> = {};
  const byProject:  Record<string, number> = {};

  for (const e of entries) {
    byCategory[e.category]   = (byCategory[e.category]   ?? 0) + 1;
    const pKey               = String(e.projectId ?? "global");
    byProject[pKey]          = (byProject[pKey]          ?? 0) + 1;
  }

  return { total: entries.length, byCategory, byProject };
}

// ── Reconcile ─────────────────────────────────────────────────────────────────

/**
 * De-duplicate entries for a project by content prefix.
 * Keeps the entry with the higher score or newer createdAt.
 */
export function reconcile(projectId: number): void {
  const entries = [..._store.values()].filter((e) => e.projectId === projectId);
  const seen    = new Map<string, MemoryEntry>();
  const removed: string[] = [];

  for (const entry of entries) {
    const key = entry.content.slice(0, 80).toLowerCase().trim();
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if (entry.score > existing.score || entry.createdAt > existing.createdAt) {
        _store.delete(existing.id!);
        removed.push(existing.id!);
        seen.set(key, entry);
      } else {
        _store.delete(entry.id!);
        removed.push(entry.id!);
      }
    } else {
      seen.set(key, entry);
    }
  }

  if (removed.length > 0) {
    memoryTelemetry.reconciled({
      conflictId:  `reconcile-${projectId}-${Date.now()}`,
      resolution:  "kept_higher_confidence",
      affectedIds: removed,
    });
  }
}

// ── Archive ───────────────────────────────────────────────────────────────────

/**
 * Archive (delete) low-score or stale entries for a project.
 */
export function archive(projectId: number): void {
  const now     = Date.now();
  const entries = [..._store.values()].filter((e) => e.projectId === projectId);

  for (const entry of entries) {
    const isLowScore = entry.score < 0.2;
    const isStale    = entry.lastUsedAt < now - 30 * 24 * 60 * 60 * 1000 && entry.usedCount === 0;

    if (isLowScore || isStale) {
      _store.delete(entry.id!);
      memoryTelemetry.archived({
        entryId:   entry.id!,
        reason:    isStale ? "expired" : "low_score",
        projectId,
      });
    }
  }
}
