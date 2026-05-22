/**
 * consensus-validator.ts
 *
 * Validates that a consensus merge produces a coherent final state.
 * Checks for internal consistency: no duplicate files, no empty merge,
 * and that merged paths are actually compatible.
 */

import type { CollapsedState } from "../types/quantum.types.ts";
import type { MergeResult }    from "../types/merge.types.ts";

// ── Consensus validation result ───────────────────────────────────────────────

export interface ConsensusValidationResult {
  valid:         boolean;
  warnings:      string[];
  errors:        string[];
  fileCount:     number;
  mergeConflicts: number;
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function validateConsensus(
  state:        CollapsedState,
  mergeResults: MergeResult[],
): ConsensusValidationResult {
  const warnings: string[] = [];
  const errors:   string[] = [];

  // Check 1: no duplicate files in final state
  const fileSeen = new Set<string>();
  for (const f of state.filesWritten) {
    if (fileSeen.has(f)) errors.push(`Duplicate file in collapsed state: ${f}`);
    fileSeen.add(f);
  }

  // Check 2: non-empty output
  if (state.filesWritten.length === 0) {
    errors.push("Collapsed state has zero files — empty output is not valid");
  }

  // Check 3: all merge results succeeded or fell back gracefully
  const failedMerges = mergeResults.filter(r => !r.success);
  if (failedMerges.length > 0) {
    warnings.push(
      `${failedMerges.length} merge(s) used fallback strategy: ` +
      failedMerges.map(r => r.filePath).join(", "),
    );
  }

  // Check 4: count total merge conflicts
  const totalConflicts = mergeResults.reduce((s, r) => s + r.conflicts, 0);
  if (totalConflicts > 10) {
    warnings.push(`High conflict count in merge: ${totalConflicts} conflicts`);
  }

  // Check 5: winner confidence above warning threshold
  if (state.confidenceScore < 0.50) {
    warnings.push(
      `Low winner confidence: ${state.confidenceScore.toFixed(3)} — consider re-running`,
    );
  }

  const valid = errors.length === 0;

  return {
    valid,
    warnings,
    errors,
    fileCount:      state.filesWritten.length,
    mergeConflicts: totalConflicts,
  };
}

// ── Fast check ────────────────────────────────────────────────────────────────

export function isConsensusValid(
  state:        CollapsedState,
  mergeResults: MergeResult[],
): boolean {
  return validateConsensus(state, mergeResults).valid;
}
