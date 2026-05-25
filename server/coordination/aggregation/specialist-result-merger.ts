/**
 * specialist-result-merger.ts
 *
 * Public entry point for the cross-agent merge intelligence system.
 * Single responsibility: delegate to MergePipeline and adapt its result.
 *
 * Execution model (full lifecycle delegated to merge-pipeline.ts):
 *   1. MergePlanBuilder — groups patches, detects conflicts, assigns winners
 *   2. ConflictGraphBuilder — cycle detection + topological resolution order
 *   3. MergeTransactionManager — begin → commit (atomic FS writes) → rollback on failure
 *   4. ReconciliationEngine — post-commit consistency verification
 *   5. MergeMemoryBridge — persist outcome for confidence learning
 *
 * Before this refactor: locks were acquired but patches never written to FS;
 *   MergeTransactionManager and ReconciliationEngine were never called.
 * After: full transactional pipeline with rollback safety and replay journaling.
 */

import { mergePipeline } from "./merge-pipeline.ts";
import type { SpecialistResult, FilePatch } from "../contracts/specialist.contracts.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MergeResult {
  runId:          string;
  patches:        FilePatch[];
  appliedCount:   number;
  skippedCount:   number;
  durationMs:     number;
  consistent:     boolean;
  txId:           string;
  cyclesDetected: number;
}

// ── Merger ────────────────────────────────────────────────────────────────────

export class SpecialistResultMerger {
  /**
   * Merge all specialist results into a committed, reconciled patch set.
   * Delegates to MergePipeline — never throws.
   *
   * Returns a MergeResult describing what was applied and whether the
   * post-merge reconciliation passed.
   */
  async merge(runId: string, results: SpecialistResult[]): Promise<MergeResult> {
    return mergePipeline.run(runId, results);
  }
}

export const specialistResultMerger = new SpecialistResultMerger();
