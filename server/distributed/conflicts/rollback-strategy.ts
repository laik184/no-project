/**
 * Responsibility: Rollback strategy for irresolvable write conflicts.
 *                 Determines whether to roll back to ancestor content, reject the write,
 *                 or escalate to supervisor arbitration.
 * Dependencies: write-conflict-detector (types only)
 * Failure: unknown strategy defaults to "reject" — fail-closed.
 * Telemetry: distributed.conflict emitted by conflict-resolver before calling this.
 */

import type { WriteConflict } from "./write-conflict-detector.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RollbackDecision =
  | "use_ancestor"    // restore original content — undo both writers
  | "use_ours"        // accept the first writer (ownerId of writers[0])
  | "use_theirs"      // accept the second writer (ownerId of writers[1])
  | "reject_all"      // reject all writes — file unchanged
  | "escalate";       // route to supervisor arbitration

export interface RollbackOutcome {
  decision:     RollbackDecision;
  winnerOwnerId?: string;
  reason:       string;
}

// ── Strategy ──────────────────────────────────────────────────────────────────

class RollbackStrategy {
  /**
   * Select rollback decision for a conflict.
   * Priority rules (in order):
   *   1. If only 2 writers and one is a "verification" agent → reject verifier write (ours wins).
   *   2. If conflict is on a critical file (tsconfig, package.json) → use_ancestor.
   *   3. If one writer is clearly newer → use_theirs (most recent).
   *   4. Default → escalate.
   */
  decide(conflict: WriteConflict, ancestorContent?: string): RollbackOutcome {
    const writers = conflict.writers;

    // Rule 1: verification agents should never overwrite builder output
    const verifierWriter = writers.find(w =>
      w.ownerId.includes("verif") || w.ownerId.includes("review"),
    );
    if (verifierWriter && writers.length === 2) {
      const other = writers.find(w => w !== verifierWriter)!;
      return {
        decision:      "use_ours",
        winnerOwnerId: other.ownerId,
        reason:        "verifier write rejected — builder output preserved",
      };
    }

    // Rule 2: critical config files → restore ancestor
    const criticalFiles = ["package.json", "tsconfig.json", "drizzle.config.ts", ".env"];
    if (criticalFiles.some(f => conflict.path.endsWith(f)) && ancestorContent !== undefined) {
      return {
        decision: "use_ancestor",
        reason:   "critical config file — ancestor content restored",
      };
    }

    // Rule 3: most recent writer wins
    if (writers.length >= 2) {
      const newest = writers.reduce((a, b) => a.registeredAt > b.registeredAt ? a : b);
      return {
        decision:      "use_theirs",
        winnerOwnerId: newest.ownerId,
        reason:        "most recent writer wins",
      };
    }

    // Default: escalate
    return { decision: "escalate", reason: "no automated resolution — supervisor required" };
  }

  /** Apply the rollback decision to get the final content to write. */
  apply(
    decision:        RollbackDecision,
    winnerOwnerId:   string | undefined,
    conflict:        WriteConflict,
    ancestorContent: string,
  ): string | null {
    switch (decision) {
      case "use_ancestor":  return ancestorContent;
      case "reject_all":    return null; // signal: do not write
      case "use_ours":
      case "use_theirs": {
        const winner = conflict.writers.find(w => w.ownerId === winnerOwnerId);
        return winner?.content ?? ancestorContent;
      }
      case "escalate": return null; // caller handles escalation
    }
  }
}

export const rollbackStrategy = new RollbackStrategy();
