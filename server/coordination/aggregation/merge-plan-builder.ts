/**
 * merge-plan-builder.ts
 *
 * Builds a MergePlan from specialist results.
 * Single responsibility: group patches by file, identify conflicts, assign winners.
 *
 * Merge ordering:
 *   database(1) → backend(2) → security(3) → runtime(4) → frontend(5) → verification(6)
 *
 * Cycle safety (added):
 *   ConflictGraphBuilder runs after conflict detection. If cycles are found,
 *   a warning is emitted and the plan continues with MergePlan order (fallback).
 *   If no cycles, the topological order from the graph is used to sort groups,
 *   ensuring dependencies are resolved in the correct order.
 *
 * Each PatchGroup has at most one winner selected by ResolutionStrategy.
 */

import type { SpecialistResult, FilePatch, SpecialistDomain }
  from "../contracts/specialist.contracts.ts";
import type { MergePlan, PatchGroup }
  from "../contracts/coordination.contracts.ts";
import { DOMAIN_MERGE_PRIORITY }         from "../contracts/specialist.contracts.ts";
import { specialistConflictDetector }    from "../conflict-resolution/specialist-conflict-detector.ts";
import { resolutionStrategy }            from "../conflict-resolution/resolution-strategy.ts";
import { conflictGraphBuilder }          from "../conflict-resolution/conflict-graph-builder.ts";
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

// ── Domain ordering ───────────────────────────────────────────────────────────

function sortByDomainPriority(results: SpecialistResult[]): SpecialistResult[] {
  return [...results].sort((a, b) =>
    (DOMAIN_MERGE_PRIORITY[a.domain] ?? 99) - (DOMAIN_MERGE_PRIORITY[b.domain] ?? 99)
  );
}

// ── Plan builder ──────────────────────────────────────────────────────────────

export class MergePlanBuilder {
  /**
   * Build a MergePlan describing exactly which patch wins for each file.
   * Integrates conflict-graph cycle detection for safe ordering.
   */
  build(runId: string, results: SpecialistResult[]): MergePlan {
    const ordered        = sortByDomainPriority(results.filter(r => r.success));
    const conflictReport = specialistConflictDetector.detect(runId, ordered);

    // ── Conflict graph: cycle detection + topological ordering ──────────────
    const graph = conflictGraphBuilder.build(runId, conflictReport);
    if (graph.cycles.length > 0) {
      emit(runId, "merge.plan.cycles_detected", {
        cycleCount: graph.cycles.length,
        cycles:     graph.cycles,
        fallback:   "proceeding_with_domain_priority_order",
      });
    }

    const groups: PatchGroup[] = [];

    // Safe (non-conflicting) patches — direct pass-through
    const safePaths = new Set(conflictReport.safe.map(p => p.filePath));
    for (const filePath of safePaths) {
      const patch = conflictReport.safe.find(p => p.filePath === filePath)!;
      groups.push({ filePath, patches: [patch], hasConflict: false, winner: patch });
    }

    // Conflicting patches — resolved via strategy chain (AST → Domain → Confidence → Size)
    for (const conflict of conflictReport.conflicts) {
      const decision = resolutionStrategy.resolve(runId, conflict);
      groups.push({
        filePath:    conflict.filePath,
        patches:     conflict.patches,
        hasConflict: true,
        winner:      decision.winnerPatch,
      });
    }

    // Apply topological ordering when graph is acyclic
    const orderedGroups = this._applyTopOrder(groups, graph.topOrder);

    const plan: MergePlan = {
      runId,
      groups:        orderedGroups,
      conflictCount: conflictReport.conflicts.length,
      safeCount:     conflictReport.safe.length,
    };

    emit(runId, "merge.plan.built", {
      groupCount:    orderedGroups.length,
      conflictCount: plan.conflictCount,
      safeCount:     plan.safeCount,
      cyclesDetected: graph.cycles.length,
      topOrderUsed:  graph.topOrder.length > 0,
    });

    return plan;
  }

  /** Apply topological order from conflict graph to group sequence. */
  private _applyTopOrder(groups: PatchGroup[], topOrder: string[]): PatchGroup[] {
    if (topOrder.length === 0) return groups;  // cyclic — keep plan order
    const orderIndex = new Map(topOrder.map((fp, i) => [fp, i]));
    return [...groups].sort((a, b) =>
      (orderIndex.get(a.filePath) ?? 999) - (orderIndex.get(b.filePath) ?? 999)
    );
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
