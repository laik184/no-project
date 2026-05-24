/**
 * specialist-result-merger.ts
 *
 * Merges all specialist results into a single unified patch set.
 * Single responsibility: MergePlan execution + lock-safe file application.
 *
 * Execution model:
 *   1. Build MergePlan (groups + winners via MergePlanBuilder)
 *   2. For each winner patch, acquire exclusive file lock
 *   3. Apply patch (in-memory — real FS write delegated to patch-engine)
 *   4. Release lock
 *   5. Emit telemetry per patch
 */

import { unifiedLockCoordinator } from "../../quantum/locks/unified-lock-coordinator.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";
import { mergePlanBuilder }      from "./merge-plan-builder.ts";
import type { SpecialistResult, FilePatch }
  from "../contracts/specialist.contracts.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MergeResult {
  runId:        string;
  patches:      FilePatch[];
  appliedCount: number;
  skippedCount: number;
  durationMs:   number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId,
    phase:     "coordination",
    agentName: "specialist-result-merger",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Merger ────────────────────────────────────────────────────────────────────

export class SpecialistResultMerger {
  /**
   * Merge all specialist results into a unified patch list.
   * Conflicts resolved by MergePlanBuilder → ResolutionStrategy.
   * Each winning patch is lock-gated before being returned.
   */
  async merge(runId: string, results: SpecialistResult[]): Promise<MergeResult> {
    const t0   = Date.now();
    const plan = mergePlanBuilder.build(runId, results);

    emit(runId, "merge.start", {
      groupCount:    plan.groups.length,
      conflictCount: plan.conflictCount,
    });

    const appliedPatches: FilePatch[] = [];
    let applied  = 0;
    let skipped  = 0;

    for (const group of plan.groups) {
      if (!group.winner) {
        skipped++;
        continue;
      }

      // Acquire exclusive lock before applying patch
      const lockResult = await unifiedLockCoordinator.acquire(group.filePath, {
        ownerId:   `merger:${runId}`,
        runId,
        timeoutMs: 8_000,
      });

      if (!lockResult.acquired) {
        emit(runId, "merge.patch.skipped", {
          filePath: group.filePath,
          reason:   "lock_acquisition_failed",
        });
        skipped++;
        continue;
      }

      try {
        appliedPatches.push(group.winner);
        applied++;
        emit(runId, "merge.patch.applied", {
          filePath:    group.filePath,
          operation:   group.winner.operation,
          hadConflict: group.hasConflict,
          confidence:  group.winner.confidence,
        });
      } finally {
        lockResult.handle?.release();
      }
    }

    const durationMs = Date.now() - t0;

    emit(runId, "merge.complete", {
      applied, skipped, durationMs,
      totalPatches: appliedPatches.length,
    });

    return {
      runId,
      patches:      appliedPatches,
      appliedCount: applied,
      skippedCount: skipped,
      durationMs,
    };
  }
}

export const specialistResultMerger = new SpecialistResultMerger();
