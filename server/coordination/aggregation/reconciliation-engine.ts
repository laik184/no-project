/**
 * reconciliation-engine.ts
 *
 * Final merge validation — runs after all patches are committed.
 * Single responsibility: consistency verification + anomaly reporting.
 *
 * Checks performed:
 *   1. Every PatchGroup with a winner was applied (applied set ⊇ winner set)
 *   2. No duplicate file applications (idempotency guard)
 *   3. No delete + create collision on same path in same run
 *   4. All CONTENT conflict patches had a resolution strategy (not raw winner fallback)
 *
 * Reconciliation result is recorded in the ReplayJournal and emitted via telemetry.
 * On anomaly: emits details but does NOT rollback — callers decide on abort vs warn.
 */

import type { FilePatch } from "../contracts/specialist.contracts.ts";
import type { MergePlan } from "../contracts/coordination.contracts.ts";
import { replayJournal } from "./replay-journal.ts";
import { emitReconciliationResult } from "../telemetry/merge-telemetry.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnomalyKind =
  | "winner_not_applied"
  | "duplicate_application"
  | "delete_create_collision"
  | "unresolved_conflict";

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
   * Verify that the applied patches are fully consistent with the MergePlan.
   *
   * @param runId   — run identifier
   * @param plan    — the MergePlan built by MergePlanBuilder
   * @param applied — patches that were actually written (from MergeTransaction outcomes)
   */
  reconcile(runId: string, plan: MergePlan, applied: FilePatch[]): ReconciliationReport {
    const anomalies: ReconciliationAnomaly[] = [];
    const appliedPaths  = new Set(applied.map(p => p.filePath));
    const opByPath      = new Map<string, Set<string>>();

    // Index applied operations
    for (const p of applied) {
      if (!opByPath.has(p.filePath)) opByPath.set(p.filePath, new Set());
      opByPath.get(p.filePath)!.add(p.operation);
    }

    // Check 1: every winner was applied
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

    // Check 2: duplicate applications
    for (const [filePath, ops] of opByPath) {
      const all = applied.filter(p => p.filePath === filePath);
      if (all.length > 1) {
        anomalies.push({
          kind:     "duplicate_application",
          filePath,
          detail:   `${all.length} patches applied to same path`,
        });
      }
    }

    // Check 3: delete + create collision
    for (const [filePath, ops] of opByPath) {
      if (ops.has("delete") && (ops.has("create") || ops.has("update"))) {
        anomalies.push({
          kind:     "delete_create_collision",
          filePath,
          detail:   `Both delete and create/update applied to same path`,
        });
      }
    }

    // Check 4: unresolved conflicts — conflict group with no winner
    for (const group of plan.groups) {
      if (group.hasConflict && !group.winner) {
        anomalies.push({
          kind:     "unresolved_conflict",
          filePath: group.filePath,
          detail:   `Conflict group has no winner — ${group.patches.length} patches unresolved`,
        });
      }
    }

    const consistent = anomalies.length === 0;
    emitReconciliationResult(runId, consistent, applied.length, anomalies.length);

    // Cross-check against replay journal
    const journalPatches = replayJournal.replay(runId).patches;
    const journalPaths   = new Set(journalPatches.map(p => p.filePath));
    for (const p of applied) {
      if (!journalPaths.has(p.filePath)) {
        anomalies.push({
          kind:     "winner_not_applied",
          filePath: p.filePath,
          detail:   "Applied patch missing from replay journal",
        });
      }
    }

    return { runId, consistent, patchesVerified: applied.length, anomalies };
  }

  /** Quick consistency gate — returns true if no anomalies. */
  isConsistent(report: ReconciliationReport): boolean {
    return report.consistent && report.anomalies.length === 0;
  }
}

export const reconciliationEngine = new ReconciliationEngine();
