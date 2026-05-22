/**
 * aggregation-validator.ts
 *
 * Validates the merged state produced by the merge engine before allowing
 * the collapse engine to finalize execution.
 *
 * Fail-closed: ANY failed check blocks completion and returns valid=false.
 * The caller MUST check `valid` before proceeding.
 */

import type {
  AgentResult, MergedFileState, MergeConflict,
  ValidationReport, ValidationCheck,
} from "./aggregation-types.ts";
import { emitValidationFailed } from "./aggregation-telemetry.ts";

// ── Public API ────────────────────────────────────────────────────────────────

export function validateMergedState(
  results:          AgentResult[],
  mergedFiles:      MergedFileState[],
  conflicts:        MergeConflict[],
  runId:            string,
  projectId:        number,
): ValidationReport {
  const checks: ValidationCheck[] = [
    _checkNoUnresolvedConflicts(conflicts),
    _checkMergedContentIntegrity(mergedFiles),
    _checkDeterministicOrder(mergedFiles),
    _checkRuntimeEvidencePresent(results),
    _checkNoEmptyOutputs(results),
    _checkOwnershipCoherence(mergedFiles, results),
  ];

  const failing = checks.filter(c => !c.passed);
  const valid   = failing.length === 0;

  const report: ValidationReport = {
    valid,
    checks,
    blockedReason: valid ? undefined : failing.map(c => c.name).join(", "),
  };

  if (!valid) emitValidationFailed(runId, projectId, report);

  return report;
}

// ── Individual checks ─────────────────────────────────────────────────────────

function _checkNoUnresolvedConflicts(conflicts: MergeConflict[]): ValidationCheck {
  const unresolved = conflicts.filter(c => !c.resolved);
  return {
    name:   "no_unresolved_conflicts",
    passed: unresolved.length === 0,
    detail: unresolved.length > 0
      ? `${unresolved.length} unresolved conflict(s): ${unresolved.map(c => c.filePath).join(", ")}`
      : undefined,
  };
}

function _checkMergedContentIntegrity(mergedFiles: MergedFileState[]): ValidationCheck {
  const corrupt = mergedFiles.filter(f => !f.content || f.content.trim().length === 0);
  return {
    name:   "merged_content_integrity",
    passed: corrupt.length === 0,
    detail: corrupt.length > 0 ? `Empty content in: ${corrupt.map(f => f.filePath).join(", ")}` : undefined,
  };
}

function _checkDeterministicOrder(mergedFiles: MergedFileState[]): ValidationCheck {
  const paths    = mergedFiles.map(f => f.filePath);
  const dedupLen = new Set(paths).size;
  return {
    name:   "deterministic_merge_order",
    passed: paths.length === dedupLen,
    detail: paths.length !== dedupLen ? `Duplicate file paths in merged output` : undefined,
  };
}

function _checkRuntimeEvidencePresent(results: AgentResult[]): ValidationCheck {
  const successful   = results.filter(r => r.success);
  const withEvidence = successful.filter(r => r.runtimeEvidence !== null);

  // At least one successful result must carry runtime evidence
  const passed = successful.length === 0 || withEvidence.length > 0;
  return {
    name:   "runtime_evidence_present",
    passed,
    detail: !passed ? "No successful result carries runtime evidence" : undefined,
  };
}

function _checkNoEmptyOutputs(results: AgentResult[]): ValidationCheck {
  const successful = results.filter(r => r.success);
  const empty      = successful.filter(r => r.fileMutations.length === 0 && r.output == null);
  return {
    name:   "no_empty_successful_outputs",
    passed: empty.length === 0,
    detail: empty.length > 0
      ? `${empty.length} successful result(s) produced no output: ${empty.map(r => r.nodeId).join(", ")}`
      : undefined,
  };
}

function _checkOwnershipCoherence(
  mergedFiles: MergedFileState[],
  results:     AgentResult[],
): ValidationCheck {
  const knownNodeIds = new Set(results.map(r => r.nodeId));
  const invalid = mergedFiles.filter(f => !knownNodeIds.has(f.winnerId));
  return {
    name:   "ownership_coherence",
    passed: invalid.length === 0,
    detail: invalid.length > 0
      ? `Unknown winner IDs: ${invalid.map(f => `${f.filePath}→${f.winnerId}`).join(", ")}`
      : undefined,
  };
}
