/**
 * Responsibility: Top-level conflict resolver — detects, classifies, and resolves
 *                 write conflicts using AST merge, rollback strategy, and arbitration.
 * Dependencies: write-conflict-detector, ast-merge-engine, rollback-strategy,
 *               consensus-arbitrator, file-lock-manager
 * Failure: unresolved conflicts block the write — fail-closed. Never silently corrupts.
 * Telemetry: emits distributed.conflict on detection; distributed.consensus on resolution.
 */

import { writeConflictDetector, PendingWrite, WriteConflict } from "./write-conflict-detector.ts";
import { astMergeEngine }    from "./ast-merge-engine.ts";
import { rollbackStrategy }  from "./rollback-strategy.ts";
import { consensusArbitrator } from "./consensus-arbitrator.ts";
import { bus }               from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConflictResolution =
  | "clean_merge"
  | "rollback"
  | "arbitrated"
  | "rejected"
  | "no_conflict";

export interface ResolveResult {
  path:       string;
  resolution: ConflictResolution;
  content:    string | null;
  conflicts:  number;
}

// ── Resolver ─────────────────────────────────────────────────────────────────

class ConflictResolver {
  /** Register a write intent before acquiring the file lock. */
  registerIntent(write: PendingWrite): void {
    writeConflictDetector.register(write);
  }

  /** Deregister a write intent after lock acquired or write abandoned. */
  deregisterIntent(path: string, ownerId: string): void {
    writeConflictDetector.deregister(path, ownerId);
  }

  /** Resolve a conflict for a specific path. */
  async resolve(
    conflict:        WriteConflict,
    ancestorContent: string,
    runId:           string,
    projectId:       number,
  ): Promise<ResolveResult> {
    // 1. Try AST merge if exactly 2 writers
    if (conflict.writers.length === 2) {
      const mergeResult = astMergeEngine.merge({
        ancestor: ancestorContent,
        ours:     conflict.writers[0].content,
        theirs:   conflict.writers[1].content,
        path:     conflict.path,
      });

      if (mergeResult.outcome === "clean") {
        this.emitResolved(runId, projectId, conflict.path, "clean_merge");
        return { path: conflict.path, resolution: "clean_merge", content: mergeResult.content, conflicts: 0 };
      }
    }

    // 2. Try rollback strategy
    const rollback = rollbackStrategy.decide(conflict, ancestorContent);

    if (rollback.decision !== "escalate") {
      const content = rollbackStrategy.apply(
        rollback.decision,
        rollback.winnerOwnerId,
        conflict,
        ancestorContent,
      );
      const resolution = content !== null ? "rollback" : "rejected";
      this.emitResolved(runId, projectId, conflict.path, resolution);
      return { path: conflict.path, resolution, content, conflicts: conflict.writers.length };
    }

    // 3. Escalate to supervisor arbitration
    const arbitration = await consensusArbitrator.arbitrate(runId, projectId, conflict, ancestorContent);
    const resolution  = arbitration.content !== null ? "arbitrated" : "rejected";
    this.emitResolved(runId, projectId, conflict.path, resolution);
    return {
      path:       conflict.path,
      resolution,
      content:    arbitration.content,
      conflicts:  conflict.writers.length,
    };
  }

  /** Scan all registered intents for conflicts and resolve them. */
  async resolveAll(
    ancestorMap: Map<string, string>,
    runId:       string,
    projectId:   number,
  ): Promise<ResolveResult[]> {
    const conflicts = writeConflictDetector.detectAll();
    return Promise.all(
      conflicts.map(c => this.resolve(c, ancestorMap.get(c.path) ?? "", runId, projectId)),
    );
  }

  private emitResolved(runId: string, projectId: number, path: string, resolution: ConflictResolution): void {
    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.conflict",
      agentName: "conflict-resolver",
      eventType: "distributed.consensus",
      payload:   { path, resolution },
      ts:        Date.now(),
    });
  }
}

export const conflictResolver = new ConflictResolver();
