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
 * Persistence: in-process Map (always) + Redis LPUSH/LRANGE (when available).
 * The Redis path is backed by redis-replay-store.ts — fire-and-forget, never throws.
 */

import type { FilePatch }       from "../contracts/specialist.contracts.ts";
import { emitJournalEntry }     from "../telemetry/merge-telemetry.ts";
import { redisReplayStore }     from "../../infrastructure/replay/redis-replay-store.ts";
import { bus }                  from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id:         string;
  runId:      string;
  txId:       string;
  filePath:   string;
  operation:  FilePatch["operation"];
  content?:   string;
  strategy:   string;     // "DOMAIN_PRIORITY" | "CONFIDENCE" | ... | "DIRECT"
  confidence: number;
  recordedAt: number;
}

export interface ReplayResult {
  runId:   string;
  entries: JournalEntry[];
  patches: FilePatch[];
  source:  "in-process" | "redis";
}

// ── Telemetry helpers ─────────────────────────────────────────────────────────

function emitReplayStarted(runId: string, source: "in-process" | "redis"): void {
  bus.emit("agent.event", {
    runId,
    projectId: 0,
    phase:     "replay.journal",
    agentName: "replay-journal",
    eventType: "replay.started" as any,
    payload:   { runId, source },
    ts:        Date.now(),
  });
}

function emitReplayCompleted(runId: string, entryCount: number, source: "in-process" | "redis"): void {
  bus.emit("agent.event", {
    runId,
    projectId: 0,
    phase:     "replay.journal",
    agentName: "replay-journal",
    eventType: "replay.completed" as any,
    payload:   { runId, entryCount, source },
    ts:        Date.now(),
  });
}

// ── Journal ───────────────────────────────────────────────────────────────────

let _seq = 0;

export class ReplayJournal {
  /** runId → ordered entries (in-process fast path, always populated) */
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

    // Always write to in-process store (guaranteed sync path)
    if (!this._store.has(runId)) this._store.set(runId, []);
    this._store.get(runId)!.push(entry);

    // Emit telemetry
    emitJournalEntry(runId, entry.id, patch.filePath, strategy);

    // Fire-and-forget: persist to Redis for cross-node / cross-restart replay.
    // Never throws — redis-replay-store falls back to its own in-process map on error.
    redisReplayStore.append(entry as any).catch(() => { /* redis-replay-store already warns */ });

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
  async replay(runId: string): Promise<ReplayResult> {
    const localEntries = this._store.get(runId);

    // Fast path: in-process data is current — no Redis round-trip needed.
    if (localEntries?.length) {
      emitReplayStarted(runId, "in-process");
      const patches = _entriesToPatches(localEntries);
      emitReplayCompleted(runId, localEntries.length, "in-process");
      return { runId, entries: localEntries, patches, source: "in-process" };
    }

    // Hydration path: process restarted — load from Redis.
    emitReplayStarted(runId, "redis");
    const remoteEntries = await redisReplayStore.load(runId);
    const asLocal = remoteEntries as unknown as JournalEntry[];

    // Populate in-process cache so subsequent replay() calls use fast path.
    if (asLocal.length) this._store.set(runId, asLocal);

    const patches = _entriesToPatches(asLocal);
    emitReplayCompleted(runId, asLocal.length, "redis");
    return { runId, entries: asLocal, patches, source: "redis" };
  }

  /**
   * Sync replay — returns in-process entries only (no Redis round-trip).
   * Used by merge-pipeline.ts Stage 6 reconciliation (in-process is always
   * current during an active merge session; no await required there).
   */
  replaySync(runId: string): { runId: string; entries: JournalEntry[]; patches: FilePatch[] } {
    const entries = this._store.get(runId) ?? [];
    return { runId, entries, patches: _entriesToPatches(entries) };
  }

  /** All entries for a run, ordered by recordedAt. */
  entries(runId: string): JournalEntry[] {
    return [...(this._store.get(runId) ?? [])].sort((a, b) => a.recordedAt - b.recordedAt);
  }

  /** Remove journal entries for a run (e.g. after successful deployment). */
  async purge(runId: string): Promise<number> {
    const count = this._store.get(runId)?.length ?? 0;
    this._store.delete(runId);
    await redisReplayStore.purge(runId).catch(() => { /* best-effort */ });
    return count;
  }

  /** Count of journal entries across all runs (in-process). */
  totalEntries(): number {
    let n = 0;
    for (const entries of this._store.values()) n += entries.length;
    return n;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _entriesToPatches(entries: JournalEntry[]): FilePatch[] {
  return entries.map(e => ({
    filePath:   e.filePath,
    operation:  e.operation,
    content:    e.content,
    confidence: e.confidence,
  }));
}

export const replayJournal = new ReplayJournal();
