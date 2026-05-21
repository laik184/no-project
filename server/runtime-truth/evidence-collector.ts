/**
 * server/runtime-truth/evidence-collector.ts
 *
 * RuntimeEvidenceCollector — aggregates EvidenceItems into backed claims.
 * A claim is satisfied only when ALL required evidence items are:
 *   1. present
 *   2. value === true
 *   3. fresh (not past TTL)
 *
 * No external I/O. Pure aggregation logic.
 */

import type { EvidenceItem, EvidenceClaim, EvidenceKind } from "./types.ts";

// ─── Claim definitions ────────────────────────────────────────────────────────

const CLAIM_REQUIREMENTS: Record<string, readonly EvidenceKind[]> = {
  "server_running": ["PID_ALIVE", "PORT_OPEN", "CRASH_LOOP_ABSENT"],
  "typescript_valid": ["TSC_EXIT_0"],
  "dependencies_intact": ["DEPENDENCIES_INTACT"],
  "preview_healthy": ["HTTP_200", "DOM_VALID"],
  "process_stable": ["PID_ALIVE", "PROCESS_STABLE", "CRASH_LOOP_ABSENT"],
  "import_graph_clean": ["IMPORT_GRAPH_CLEAN"],
  "filesystem_intact": ["FILESYSTEM_INTACT"],
  "fully_verified": [
    "PID_ALIVE",
    "PORT_OPEN",
    "TSC_EXIT_0",
    "IMPORT_GRAPH_CLEAN",
    "DEPENDENCIES_INTACT",
    "HTTP_200",
    "DOM_VALID",
    "CRASH_LOOP_ABSENT",
    "FILESYSTEM_INTACT",
  ],
};

export class RuntimeEvidenceCollector {
  private _items: EvidenceItem[] = [];

  add(items: readonly EvidenceItem[]): void {
    const now = Date.now();
    for (const item of items) {
      // Replace any existing item of the same kind
      const idx = this._items.findIndex((e) => e.kind === item.kind);
      if (idx >= 0) {
        this._items[idx] = item;
      } else {
        this._items.push(item);
      }
    }
    // Evict fully expired items
    this._items = this._items.filter((i) => now < i.collectedAt + i.ttlMs);
  }

  evaluate(claimName: string): EvidenceClaim {
    const required = CLAIM_REQUIREMENTS[claimName];
    if (!required) {
      return {
        claim: claimName,
        satisfied: false,
        evidence: [],
        stalePieces: 0,
      };
    }

    const now = Date.now();
    const gathered: EvidenceItem[] = [];
    let stale = 0;
    let satisfied = true;

    for (const kind of required) {
      const item = this._items.find((e) => e.kind === kind);
      if (!item) {
        satisfied = false;
        gathered.push({
          kind,
          value: false,
          detail: "Evidence not yet collected",
          collectedAt: 0,
          ttlMs: 0,
        });
        continue;
      }

      const isStale = now > item.collectedAt + item.ttlMs;
      if (isStale) { stale++; satisfied = false; }
      if (!item.value) satisfied = false;

      gathered.push(item);
    }

    return {
      claim: claimName,
      satisfied,
      evidence: Object.freeze(gathered),
      stalePieces: stale,
    };
  }

  all(): ReadonlyArray<EvidenceItem> {
    return Object.freeze([...this._items]);
  }

  fresh(): ReadonlyArray<EvidenceItem> {
    const now = Date.now();
    return Object.freeze(
      this._items.filter((i) => now < i.collectedAt + i.ttlMs)
    );
  }

  clear(): void {
    this._items = [];
  }

  staleness(): { stale: number; total: number } {
    const now = Date.now();
    const stale = this._items.filter((i) => now >= i.collectedAt + i.ttlMs).length;
    return { stale, total: this._items.length };
  }
}
