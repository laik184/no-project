/**
 * reconciliation-engine.ts
 *
 * Final merge validation — runs after all patches are committed.
 * Single responsibility: consistency verification + anomaly reporting.
 *
 * Checks performed (all run before consistent flag is computed):
 *   1. Every PatchGroup with a winner was applied (applied set ⊇ winner set)
 *   2. No duplicate file applications (idempotency guard)
 *   3. No delete + create/update collision on same path in same run
 *   4. All CONTENT conflict patch groups had a winner (no unresolved conflicts)
 *   5. Every applied patch appears in the ReplayJournal (replay-safety guard)
 *
 * BUGFIX: consistent flag is now computed AFTER all checks including the
 *   replay-journal cross-check. Previously, `consistent` was set before the
 *   journal cross-check ran, allowing `isConsistent()` to return true even
 *   when journal anomalies were detected.
 *
 * Reconciliation result emitted via telemetry (merge.reconcile.complete).
 * On anomaly: emits details but does NOT rollback — callers decide abort vs warn.
 */

import type { FilePatch } from "../contracts/specialist.contracts.ts";
import type { MergePlan } from "../contracts/coordination.contracts.ts";
import { replayJournal }  from "./replay-journal.ts";
import { emitReconcileComplete } from "../telemetry/merge-telemetry.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnomalyKind =
  | "winner_not_applied"
  | "duplicate_application"
  | "delete_create_collision"
  | "unresolved_conflict"
  | "journal_missing";

export interface ReconciliationAnomaly {
  kind:     AnomalyKind;
  filePath: string;
  detail:   string;
}

export interface ReconciliationReport {
  runId:           string;
  consistent:      boolean;
  patchesVerified: number;
  anomalies:       ReconciliationAnomaly[];
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class ReconciliationEngine {
  /**
   * Verify that applied patches are fully consistent with the MergePlan.
   * All checks run before the `consistent` flag is computed (fixes prior bug).
   *
   * @param runId   — run identifier
   * @param plan    — MergePlan built by MergePlanBuilder
   * @param applied — patches actually written (from MergeTransaction outcomes)
   */
  reconcile(runId: string, plan: MergePlan, applied: FilePatch[]): ReconciliationReport {
    const anomalies:  ReconciliationAnomaly[] = [];
    const appliedPaths = new Set(applied.map(p => p.filePath));
    const opByPath     = new Map<string, Set<string>>();

    // Index applied operations per file
    for (const p of applied) {
      if (!opByPath.has(p.filePath)) opByPath.set(p.filePath, new Set());
      opByPath.get(p.filePath)!.add(p.operation);
    }

    // Check 1: every group winner was applied
    for (const group of plan.groups) {
      if (!group.winner) continue;
      if (!appliedPaths.has(group.filePath)) {
        anomalies.push({
          kind:     "winner_not_applied",
          filePath: group.filePath,
          detail:   `Winner patch (${group.winner.operation}) was never applied`,
        });
      }
    }

    // Check 2: no duplicate patch applications on same file
    for (const [filePath, _ops] of opByPath) {
      const all = applied.filter(p => p.filePath === filePath);
      if (all.length > 1) {
        anomalies.push({
          kind:     "duplicate_application",
          filePath,
          detail:   `${all.length} patches applied to same path (idempotency violation)`,
        });
      }
    }

    // Check 3: delete + create/update collision
    for (const [filePath, ops] of opByPath) {
      if (ops.has("delete") && (ops.has("create") || ops.has("update"))) {
        anomalies.push({
          kind:     "delete_create_collision",
          filePath,
          detail:   `Both delete and create/update applied to same path`,
        });
      }
    }

    // Check 4: conflict groups with no winner
    for (const group of plan.groups) {
      if (group.hasConflict && !group.winner) {
        anomalies.push({
          kind:     "unresolved_conflict",
          filePath: group.filePath,
          detail:   `Conflict group (${group.patches.length} patches) has no winner`,
        });
      }
    }

    // Check 5: every applied patch present in replay journal (replay-safety)
    // NOTE: This check runs BEFORE consistent is computed (fixes prior bug)
    const journalPaths = new Set(replayJournal.replay(runId).patches.map(p => p.filePath));
    for (const p of applied) {
      if (!journalPaths.has(p.filePath)) {
        anomalies.push({
          kind:     "journal_missing",
          filePath: p.filePath,
          detail:   "Applied patch missing from ReplayJournal — replay will diverge",
        });
      }
    }

    // consistent computed AFTER all checks (fixes the prior early-evaluation bug)
    const consistent = anomalies.length === 0;

    emitReconcileComplete(runId, consistent, applied.length, anomalies.length);

    return { runId, consistent, patchesVerified: applied.length, anomalies };
  }

  /** Quick gate — true only if no anomalies of any kind were detected. */
  isConsistent(report: ReconciliationReport): boolean {
    return report.consistent && report.anomalies.length === 0;
  }
}

export const reconciliationEngine = new ReconciliationEngine();
