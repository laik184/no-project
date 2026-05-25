/**
 * replay-journal.ts
 *
 * Records every merge decision with enough context for deterministic replay.
 * Single responsibility: append-only journal write + replay read path.
 *
 * Each JournalEntry captures:
 *   - The runId and txId that produced the decision
 *   - The file path, operation, and winning content
 *   - The resolution strategy that selected the winner
 *   - Timestamp for ordering
 *
 * Replay: given a runId, emit all patches in journal order to reproduce the merge.
 *
 * Journal is in-process (Map-based). Swap to Redis LPUSH/LRANGE for multi-node.
 */

import type { FilePatch } from "../contracts/specialist.contracts.ts";
import { emitJournalEntry } from "../telemetry/merge-telemetry.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id:        string;
  runId:     string;
  txId:      string;
  filePath:  string;
  operation: FilePatch["operation"];
  content?:  string;
  strategy:  string;     // "DOMAIN_PRIORITY" | "CONFIDENCE" | ... | "DIRECT"
  confidence: number;
  recordedAt: number;
}

export interface ReplayResult {
  runId:   string;
  entries: JournalEntry[];
  patches: FilePatch[];
}

// ── Journal ───────────────────────────────────────────────────────────────────

let _seq = 0;

export class ReplayJournal {
  /** runId → ordered entries */
  private readonly _store = new Map<string, JournalEntry[]>();

  /** Append one patch decision to the journal. */
  record(
    runId:    string,
    txId:     string,
    patch:    FilePatch,
    strategy: string,
  ): JournalEntry {
    const entry: JournalEntry = {
      id:         `jrn-${++_seq}-${Date.now()}`,
      runId,
      txId,
      filePath:   patch.filePath,
      operation:  patch.operation,
      content:    patch.content,
      strategy,
      confidence: patch.confidence,
      recordedAt: Date.now(),
    };

    if (!this._store.has(runId)) this._store.set(runId, []);
    this._store.get(runId)!.push(entry);

    emitJournalEntry(runId, entry.id, patch.filePath, strategy);
    return entry;
  }

  /** Record a batch of patches from a committed transaction. */
  recordBatch(
    runId:    string,
    txId:     string,
    patches:  FilePatch[],
    strategy: string,
  ): JournalEntry[] {
    return patches.map(p => this.record(runId, txId, p, strategy));
  }

  /** Replay all journal entries for a runId as FilePatch objects. */
  replay(runId: string): ReplayResult {
    const entries = this._store.get(runId) ?? [];
    const patches: FilePatch[] = entries.map(e => ({
      filePath:   e.filePath,
      operation:  e.operation,
      content:    e.content,
      confidence: e.confidence,
    }));
    return { runId, entries, patches };
  }

  /** All entries for a run, ordered by recordedAt. */
  entries(runId: string): JournalEntry[] {
    return [...(this._store.get(runId) ?? [])].sort((a, b) => a.recordedAt - b.recordedAt);
  }

  /** Remove journal entries for a run (e.g. after successful deployment). */
  purge(runId: string): number {
    const count = this._store.get(runId)?.length ?? 0;
    this._store.delete(runId);
    return count;
  }

  /** Count of journal entries across all runs. */
  totalEntries(): number {
    let n = 0;
    for (const entries of this._store.values()) n += entries.length;
    return n;
  }
}

export const replayJournal = new ReplayJournal();
