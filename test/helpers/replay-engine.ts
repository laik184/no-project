/**
 * test/helpers/replay-engine.ts
 *
 * Deterministic replay engine for test orchestration and event timelines.
 * Reconstructs exact failure scenarios from snapshots.
 */

export type ReplayEntry = {
  recordedAt: number;
  type:       "fact" | "claim" | "telemetry" | "checkpoint";
  data:       Record<string, unknown>;
};

// ── Timeline builder ──────────────────────────────────────────────────────────

export class ReplayEngine {
  private readonly _entries: ReplayEntry[] = [];

  ingest(entries: ReplayEntry[]): void {
    this._entries.push(...entries);
  }

  /** Merge and sort all ingested entries by recordedAt ascending. */
  buildTimeline(): ReplayEntry[] {
    return [...this._entries].sort((a, b) => a.recordedAt - b.recordedAt);
  }

  /** Filter timeline to a specific type. */
  filter(type: ReplayEntry["type"]): ReplayEntry[] {
    return this.buildTimeline().filter(e => e.type === type);
  }

  /** Find the last entry before a given timestamp. */
  lastBefore(ts: number): ReplayEntry | undefined {
    return this.buildTimeline().filter(e => e.recordedAt < ts).at(-1);
  }

  /** Find entries matching a predicate. */
  find(predicate: (e: ReplayEntry) => boolean): ReplayEntry[] {
    return this.buildTimeline().filter(predicate);
  }

  /** Verify the timeline is strictly ordered. */
  isOrdered(): boolean {
    const tl = this.buildTimeline();
    for (let i = 1; i < tl.length; i++) {
      if (tl[i].recordedAt < tl[i - 1].recordedAt) return false;
    }
    return true;
  }

  get count(): number { return this._entries.length; }

  reset(): void { this._entries.length = 0; }
}

// ── Snapshot adapters ─────────────────────────────────────────────────────────

export function fromMemorySnapshot(snap: {
  facts:   Array<{ recordedAt: number; [k: string]: unknown }>;
  claims:  Array<{ recordedAt: number; [k: string]: unknown }>;
}): ReplayEntry[] {
  return [
    ...snap.facts.map(f => ({ recordedAt: f.recordedAt, type: "fact"  as const, data: f })),
    ...snap.claims.map(c => ({ recordedAt: c.recordedAt, type: "claim" as const, data: c })),
  ];
}

export function fromOrchestrationSnapshot(snap: {
  checkpoints: Array<{ recordedAt: number; phase: string; [k: string]: unknown }>;
}): ReplayEntry[] {
  return snap.checkpoints.map(cp => ({
    recordedAt: cp.recordedAt,
    type:       "checkpoint" as const,
    data:       cp,
  }));
}

export function fromTelemetryCalls(
  calls: unknown[][],
): ReplayEntry[] {
  return (calls as [string, Record<string, unknown>][])
    .filter(([event]) => event === "agent.event")
    .map(([, payload]) => ({
      recordedAt: (payload.ts as number) ?? Date.now(),
      type:       "telemetry" as const,
      data:       payload,
    }));
}
