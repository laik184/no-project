/**
 * merge-memory-bridge.ts
 *
 * Persists merge outcomes as structured memory for future run optimisation.
 * Single responsibility: learn from past merges → provide strategy hints.
 *
 * Memory model:
 *   Key = `${domain}:${conflictType}` (e.g. "backend:CONTENT")
 *   Value = ring buffer of StrategyRecord (capped at MAX_RECORDS_PER_KEY)
 *
 * What is learned:
 *   - Which resolution strategy was applied per domain × conflict type
 *   - Whether the merge outcome was ultimately successful (post-reconciliation)
 *   - Confidence scores associated with winning patches
 *
 * Consumers (MergePipeline) call:
 *   mergeMemoryBridge.persist(runId, outcomes)   → record new data
 *   mergeMemoryBridge.hint(domain, conflictType) → get best strategy suggestion
 *   mergeMemoryBridge.confidence(strategy)       → historical success rate
 */

import { emitMemoryBridgeWrite } from "../telemetry/merge-telemetry.ts";
import type { SpecialistDomain } from "../contracts/specialist.contracts.ts";
import type { ConflictType }     from "../conflict-resolution/specialist-conflict-detector.ts";
import type { ResolutionStrategyName } from "../conflict-resolution/resolution-strategy.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StrategyRecord {
  runId:      string;
  filePath:   string;
  domain:     SpecialistDomain;
  conflictType: ConflictType;
  strategy:   ResolutionStrategyName;
  confidence: number;
  success:    boolean;     // did the reconciliation pass after this strategy was used?
  recordedAt: number;
}

export interface StrategyHint {
  strategy:    ResolutionStrategyName;
  successRate: number;   // 0.0–1.0
  sampleSize:  number;
}

export interface BridgeStats {
  totalRecords:  number;
  uniqueKeys:    number;
  successRate:   number;
  topStrategy:   ResolutionStrategyName | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_RECORDS_PER_KEY = 50;   // ring buffer cap per domain×conflictType bucket

// ── Bridge ────────────────────────────────────────────────────────────────────

export class MergeMemoryBridge {
  /** domain:conflictType → ring of records */
  private readonly _store = new Map<string, StrategyRecord[]>();

  /**
   * Persist a batch of merge outcomes after reconciliation completes.
   * Call once per MergePipeline run after `reconciliationEngine.reconcile()`.
   */
  persist(
    runId:     string,
    outcomes:  Array<{
      filePath:    string;
      domain:      SpecialistDomain;
      conflictType: ConflictType;
      strategy:    ResolutionStrategyName;
      confidence:  number;
      success:     boolean;
    }>,
  ): void {
    for (const o of outcomes) {
      const key = `${o.domain}:${o.conflictType}`;
      if (!this._store.has(key)) this._store.set(key, []);

      const bucket = this._store.get(key)!;
      bucket.push({
        runId,
        filePath:    o.filePath,
        domain:      o.domain,
        conflictType: o.conflictType,
        strategy:    o.strategy,
        confidence:  o.confidence,
        success:     o.success,
        recordedAt:  Date.now(),
      });

      // Cap ring buffer
      if (bucket.length > MAX_RECORDS_PER_KEY) {
        bucket.splice(0, bucket.length - MAX_RECORDS_PER_KEY);
      }

      emitMemoryBridgeWrite(runId, o.filePath, o.success ? "success" : "failure", o.strategy);
    }
  }

  /**
   * Return the best strategy hint for a given domain × conflict type.
   * Returns null if no historical data exists.
   */
  hint(domain: SpecialistDomain, conflictType: ConflictType): StrategyHint | null {
    const key    = `${domain}:${conflictType}`;
    const bucket = this._store.get(key);
    if (!bucket || bucket.length === 0) return null;

    // Aggregate success rates per strategy
    const stats = new Map<ResolutionStrategyName, { wins: number; total: number }>();
    for (const r of bucket) {
      if (!stats.has(r.strategy)) stats.set(r.strategy, { wins: 0, total: 0 });
      const s = stats.get(r.strategy)!;
      s.total++;
      if (r.success) s.wins++;
    }

    // Select strategy with highest success rate (break ties by sample size)
    let best: { strategy: ResolutionStrategyName; successRate: number; sampleSize: number } | null = null;
    for (const [strategy, { wins, total }] of stats) {
      const successRate = total > 0 ? wins / total : 0;
      if (!best || successRate > best.successRate || (successRate === best.successRate && total > best.sampleSize)) {
        best = { strategy, successRate, sampleSize: total };
      }
    }

    return best;
  }

  /**
   * Overall success rate for a specific strategy name across all buckets.
   */
  confidence(strategy: ResolutionStrategyName): number {
    let wins  = 0;
    let total = 0;
    for (const bucket of this._store.values()) {
      for (const r of bucket) {
        if (r.strategy === strategy) {
          total++;
          if (r.success) wins++;
        }
      }
    }
    return total > 0 ? wins / total : 0;
  }

  /**
   * Summary statistics for observability/telemetry dashboards.
   */
  stats(): BridgeStats {
    let totalRecords = 0;
    let wins         = 0;
    const stratCounts = new Map<ResolutionStrategyName, number>();

    for (const bucket of this._store.values()) {
      totalRecords += bucket.length;
      for (const r of bucket) {
        if (r.success) wins++;
        stratCounts.set(r.strategy, (stratCounts.get(r.strategy) ?? 0) + 1);
      }
    }

    let topStrategy: ResolutionStrategyName | null = null;
    let topCount    = 0;
    for (const [s, c] of stratCounts) {
      if (c > topCount) { topCount = c; topStrategy = s; }
    }

    return {
      totalRecords,
      uniqueKeys:  this._store.size,
      successRate: totalRecords > 0 ? wins / totalRecords : 0,
      topStrategy,
    };
  }

  /** Purge all memory records for a specific run (GDPR / privacy compliance). */
  purgeRun(runId: string): number {
    let count = 0;
    for (const [key, bucket] of this._store) {
      const before  = bucket.length;
      const filtered = bucket.filter(r => r.runId !== runId);
      count += before - filtered.length;
      if (filtered.length === 0) this._store.delete(key);
      else this._store.set(key, filtered);
    }
    return count;
  }

  /** Total number of stored strategy records. */
  totalRecords(): number {
    let n = 0;
    for (const b of this._store.values()) n += b.length;
    return n;
  }
}

export const mergeMemoryBridge = new MergeMemoryBridge();
