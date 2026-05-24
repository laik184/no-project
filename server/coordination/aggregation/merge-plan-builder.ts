/**
 * merge-plan-builder.ts
 *
 * Builds a MergePlan from specialist results.
 * Single responsibility: group patches by file, identify conflicts, assign winners.
 *
 * Merge ordering respects DOMAIN_MERGE_PRIORITY:
 *   database(1) → backend(2) → security(3) → runtime(4) → frontend(5) → verification(6)
 *
 * Each PatchGroup has at most one winner patch (selected by ResolutionStrategy).
 * Conflict-free groups copy the single patch directly.
 */

import type { SpecialistResult, FilePatch, SpecialistDomain }
  from "../contracts/specialist.contracts.ts";
import type { MergePlan, PatchGroup }
  from "../contracts/coordination.contracts.ts";
import { DOMAIN_MERGE_PRIORITY }         from "../contracts/specialist.contracts.ts";
import { specialistConflictDetector }    from "../conflict-resolution/specialist-conflict-detector.ts";
import { resolutionStrategy }            from "../conflict-resolution/resolution-strategy.ts";
import { bus }                           from "../../infrastructure/events/bus.ts";

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId,
    phase:     "coordination",
    agentName: "merge-plan-builder",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Merge ordering ────────────────────────────────────────────────────────────

function sortByDomainPriority(results: SpecialistResult[]): SpecialistResult[] {
  return [...results].sort((a, b) =>
    (DOMAIN_MERGE_PRIORITY[a.domain] ?? 99) - (DOMAIN_MERGE_PRIORITY[b.domain] ?? 99)
  );
}

// ── Plan builder ──────────────────────────────────────────────────────────────

export class MergePlanBuilder {
  /**
   * Build a MergePlan that describes exactly which patch wins for each file.
   * Conflict-free files get their patch directly.
   * Conflicting files go through ResolutionStrategy.
   */
  build(runId: string, results: SpecialistResult[]): MergePlan {
    const ordered      = sortByDomainPriority(results.filter(r => r.success));
    const conflictReport = specialistConflictDetector.detect(runId, ordered);

    emit(runId, "merge.start", {
      totalFiles:   new Set(ordered.flatMap(r => r.patches.map(p => p.filePath))).size,
      conflicts:    conflictReport.conflicts.length,
      safePatches:  conflictReport.safe.length,
    });

    const groups: PatchGroup[] = [];

    // Safe (non-conflicting) patches — direct pass-through
    const safePaths = new Set(conflictReport.safe.map(p => p.filePath));
    for (const filePath of safePaths) {
      const patch = conflictReport.safe.find(p => p.filePath === filePath)!;
      groups.push({ filePath, patches: [patch], hasConflict: false, winner: patch });
    }

    // Conflicting patches — resolved via strategy chain
    for (const conflict of conflictReport.conflicts) {
      const decision = resolutionStrategy.resolve(runId, conflict);
      groups.push({
        filePath:    conflict.filePath,
        patches:     conflict.patches,
        hasConflict: true,
        winner:      decision.winnerPatch,
      });
    }

    const plan: MergePlan = {
      runId,
      groups,
      conflictCount: conflictReport.conflicts.length,
      safeCount:     conflictReport.safe.length,
    };

    emit(runId, "merge.plan.built", {
      groupCount:    groups.length,
      conflictCount: plan.conflictCount,
      safeCount:     plan.safeCount,
    });

    return plan;
  }

  /** Extract all winning patches from a completed MergePlan. */
  extractWinners(plan: MergePlan): FilePatch[] {
    return plan.groups
      .filter(g => !!g.winner)
      .map(g => g.winner!);
  }

  /** Domain distribution summary for telemetry. */
  domainSummary(results: SpecialistResult[]): Record<SpecialistDomain, number> {
    const summary = {} as Record<SpecialistDomain, number>;
    for (const r of results) {
      summary[r.domain] = (summary[r.domain] ?? 0) + r.patches.length;
    }
    return summary;
  }
}

export const mergePlanBuilder = new MergePlanBuilder();
