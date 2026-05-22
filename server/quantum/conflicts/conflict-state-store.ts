/**
 * server/quantum/conflicts/conflict-state-store.ts
 *
 * Centralized in-process store for active conflicts, merge history, and
 * retry history across a quantum run. Provides deterministic state ownership
 * and replay-safe querying.
 *
 * All state is scoped by quantumRunId to prevent cross-run contamination.
 */

import { v4 as uuidv4 }      from "uuid";
import type {
  UnifiedConflict,
  MergeHistoryEntry,
  RetryHistoryEntry,
  ConflictResolutionStrategy,
  ConflictStatus,
} from "./conflict-types.ts";

// ── Store state ───────────────────────────────────────────────────────────────

type ConflictMap   = Map<string, UnifiedConflict>;
type MergeHistory  = MergeHistoryEntry[];
type RetryHistory  = RetryHistoryEntry[];

interface RunStore {
  conflicts:    ConflictMap;
  mergeHistory: MergeHistory;
  retryHistory: RetryHistory;
}

// ── State store ───────────────────────────────────────────────────────────────

class ConflictStateStore {
  private readonly _store = new Map<string, RunStore>();

  private _getOrCreate(quantumRunId: string): RunStore {
    if (!this._store.has(quantumRunId)) {
      this._store.set(quantumRunId, {
        conflicts:    new Map(),
        mergeHistory: [],
        retryHistory: [],
      });
    }
    return this._store.get(quantumRunId)!;
  }

  // ── Conflict CRUD ──────────────────────────────────────────────────────────

  recordConflict(conflict: UnifiedConflict): void {
    this._getOrCreate(conflict.quantumRunId).conflicts.set(conflict.conflictId, conflict);
  }

  updateStatus(quantumRunId: string, conflictId: string, status: ConflictStatus): void {
    const c = this._getOrCreate(quantumRunId).conflicts.get(conflictId);
    if (c) c.status = status;
  }

  resolveConflict(
    quantumRunId:  string,
    conflictId:    string,
    resolution:    ConflictResolutionStrategy,
    resolvedBy:    string,
  ): void {
    const c = this._getOrCreate(quantumRunId).conflicts.get(conflictId);
    if (!c) return;
    c.status     = "resolved";
    c.resolution = resolution;
    c.resolvedAt = Date.now();
    (c as any).resolvedBy = resolvedBy;
  }

  // ── Merge history ──────────────────────────────────────────────────────────

  recordMerge(quantumRunId: string, entry: Omit<MergeHistoryEntry, "entryId">): void {
    const run = this._getOrCreate(quantumRunId);
    run.mergeHistory.push({ ...entry, entryId: uuidv4() });
  }

  getMergeHistory(quantumRunId: string): MergeHistoryEntry[] {
    return [...(this._getOrCreate(quantumRunId).mergeHistory)];
  }

  // ── Retry history ──────────────────────────────────────────────────────────

  recordRetry(quantumRunId: string, entry: Omit<RetryHistoryEntry, "entryId">): void {
    const run = this._getOrCreate(quantumRunId);
    run.retryHistory.push({ ...entry, entryId: uuidv4() });
  }

  retryCountFor(quantumRunId: string, conflictId: string): number {
    return this._getOrCreate(quantumRunId).retryHistory
      .filter(r => r.conflictId === conflictId).length;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getConflict(quantumRunId: string, conflictId: string): UnifiedConflict | undefined {
    return this._getOrCreate(quantumRunId).conflicts.get(conflictId);
  }

  getActive(quantumRunId: string): UnifiedConflict[] {
    return Array.from(this._getOrCreate(quantumRunId).conflicts.values())
      .filter(c => c.status !== "resolved" && c.status !== "failed");
  }

  getAll(quantumRunId: string): UnifiedConflict[] {
    return Array.from(this._getOrCreate(quantumRunId).conflicts.values());
  }

  hasUnresolved(quantumRunId: string): boolean {
    return this.getActive(quantumRunId).length > 0;
  }

  snapshot(quantumRunId: string) {
    const run = this._getOrCreate(quantumRunId);
    return {
      totalConflicts:  run.conflicts.size,
      activeConflicts: this.getActive(quantumRunId).length,
      mergeCount:      run.mergeHistory.length,
      retryCount:      run.retryHistory.length,
    };
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  clear(quantumRunId: string): void {
    this._store.delete(quantumRunId);
  }

  clearAll(): void {
    this._store.clear();
  }
}

export const conflictStateStore = new ConflictStateStore();
