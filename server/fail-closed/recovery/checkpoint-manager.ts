/**
 * server/fail-closed/recovery/checkpoint-manager.ts
 *
 * CheckpointManager — grades and stores verification checkpoints.
 *
 * Checkpoint grades (descending trust):
 *   GRADE_A — runtime + build + imports + preview all verified
 *   GRADE_B — build + imports verified (no runtime/preview)
 *   GRADE_C — filesystem only (git-level snapshot, no verification)
 *   UNGRADED — evidence present but insufficient for any grade
 *
 * Recovery can ONLY restore GRADE_A or GRADE_B checkpoints.
 * GRADE_C is fallback only — requires full reverification after restore.
 *
 * INVARIANT: Checkpoints are immutable once created.
 * INVARIANT: Grade is deterministically computed from evidence — not assigned manually.
 */

import { randomUUID } from "crypto";
import type { Checkpoint, CheckpointGrade, Evidence } from "../contracts/types.ts";

export class CheckpointManager {
  private readonly _checkpoints = new Map<string, Checkpoint>();

  /**
   * Creates and stores a new checkpoint from a set of verified evidence.
   * Grade is computed automatically from evidence coverage.
   */
  create(
    projectId: number,
    workspacePath: string,
    evidence: readonly Evidence[],
    commitHash?: string,
    description?: string,
  ): Checkpoint {
    const grade = this._computeGrade(evidence);
    const checkpoint: Checkpoint = Object.freeze({
      id:            randomUUID().replace(/-/g, "").slice(0, 16),
      projectId,
      grade,
      createdAt:     Date.now(),
      evidence:      Object.freeze([...evidence]),
      workspacePath,
      commitHash,
      description,
    });
    this._checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }

  getById(id: string): Checkpoint | undefined {
    return this._checkpoints.get(id);
  }

  /**
   * Returns the best available checkpoint for a project that is eligible for recovery.
   * Only GRADE_A and GRADE_B are eligible.
   */
  bestRecoverable(projectId: number): Checkpoint | null {
    const eligible = [...this._checkpoints.values()]
      .filter((c) => c.projectId === projectId && this._isRecoverable(c.grade))
      .sort((a, b) => {
        // Grade A > Grade B, then newest
        const gradeScore: Record<CheckpointGrade, number> = { GRADE_A: 2, GRADE_B: 1, GRADE_C: 0, UNGRADED: -1 };
        const gradeDiff = (gradeScore[b.grade] ?? -1) - (gradeScore[a.grade] ?? -1);
        return gradeDiff !== 0 ? gradeDiff : b.createdAt - a.createdAt;
      });
    return eligible[0] ?? null;
  }

  listForProject(projectId: number): readonly Checkpoint[] {
    return Object.freeze(
      [...this._checkpoints.values()]
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => b.createdAt - a.createdAt)
    );
  }

  isRecoverable(grade: CheckpointGrade): boolean {
    return this._isRecoverable(grade);
  }

  private _isRecoverable(grade: CheckpointGrade): boolean {
    return grade === "GRADE_A" || grade === "GRADE_B";
  }

  private _computeGrade(evidence: readonly Evidence[]): CheckpointGrade {
    const has = (kind: string) => evidence.some((e) => e.kind === kind && e.value);

    const hasRuntime = has("PROCESS_ALIVE") && has("HTTP_200_STABLE") && has("NO_CRASH_LOOP");
    const hasPreview = has("PREVIEW_DOM_VALID");
    const hasBuild   = has("TSC_EXIT_0") && has("NPM_DEPS_INTACT");
    const hasImports = has("IMPORT_GRAPH_CLEAN");
    const hasFs      = evidence.length > 0;

    if (hasRuntime && hasBuild && hasImports && hasPreview) return "GRADE_A";
    if (hasBuild && hasImports)                              return "GRADE_B";
    if (hasFs)                                               return "GRADE_C";
    return "UNGRADED";
  }
}
