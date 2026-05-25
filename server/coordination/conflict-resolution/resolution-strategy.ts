/**
 * resolution-strategy.ts
 *
 * Selects a winning patch for each conflict using a prioritised strategy chain.
 * Single responsibility: conflict → resolution decision.
 *
 * Strategy chain (first conclusive result wins):
 *   1. DOMAIN_PRIORITY  — lowest DOMAIN_MERGE_PRIORITY number wins (no tie)
 *   2. CONFIDENCE       — highest confidence score wins (no tie)
 *   3. CONTENT_SIZE     — largest content wins (most complete patch)
 *   4. FIRST_WRITER     — first patch in domain-priority-sorted array (deterministic fallback)
 *
 * AST integration:
 *   For CONTENT conflicts where exactly 2 patches exist and both have content,
 *   the AstMergeEngine is consulted first. A clean AST merge short-circuits
 *   the rest of the chain and returns a synthetic merged patch.
 *
 * BUGFIX (domain priority tie detection):
 *   Prior implementation used `patches[i] !== best` to detect ties, which
 *   relied on object identity. Fixed to compare domain priority values directly
 *   and count candidates with the same minimum priority.
 */

import type { SpecialistConflict } from "./specialist-conflict-detector.ts";
import type { FilePatch }          from "../contracts/specialist.contracts.ts";
import { DOMAIN_MERGE_PRIORITY, type SpecialistDomain }
  from "../contracts/specialist.contracts.ts";
import { astMergeEngine }          from "../../distributed/conflicts/ast-merge-engine.ts";
import { bus }                     from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResolutionStrategyName =
  | "AST_MERGE"
  | "DOMAIN_PRIORITY"
  | "CONFIDENCE"
  | "CONTENT_SIZE"
  | "FIRST_WRITER";

export interface ResolutionDecision {
  filePath:      string;
  winnerPatch:   FilePatch;
  strategy:      ResolutionStrategyName;
  rejectedCount: number;
  reasoning:     string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emitResolved(runId: string, decision: ResolutionDecision): void {
  bus.emit("agent.event", {
    runId,
    phase:     "coordination",
    agentName: "resolution-strategy",
    eventType: "merge.conflict.resolved",
    payload:   {
      filePath:  decision.filePath,
      strategy:  decision.strategy,
      reasoning: decision.reasoning,
    },
    ts: Date.now(),
  });
}

// ── Strategy 0: AST merge (CONTENT conflicts with exactly 2 patches) ──────────

function byAstMerge(
  filePath: string,
  patches:  FilePatch[],
  type:     string,
): { winner: FilePatch; strategy: ResolutionStrategyName; reasoning: string } | null {
  if (type !== "CONTENT" || patches.length !== 2) return null;

  const [a, b] = patches;
  if (!a.content || !b.content) return null;

  const result = astMergeEngine.merge({
    ancestor: "",      // no common ancestor available here; use empty string
    ours:     a.content,
    theirs:   b.content,
    path:     filePath,
  });

  if (result.outcome !== "clean") return null;

  return {
    winner: {
      filePath,
      operation:  a.operation,
      content:    result.content,
      confidence: Math.max(a.confidence, b.confidence),
    },
    strategy:  "AST_MERGE",
    reasoning: "AST 3-way merge produced clean result — both patches synthesised",
  };
}

// ── Strategy 1: Domain priority ───────────────────────────────────────────────

function byDomainPriority(
  patches: FilePatch[],
  domains: SpecialistDomain[],
): { winner: FilePatch; strategy: ResolutionStrategyName; reasoning: string } | null {
  // Find minimum priority value
  const priorities = domains.map(d => DOMAIN_MERGE_PRIORITY[d] ?? 99);
  const minPriority = Math.min(...priorities);

  // Count how many candidates share the minimum priority (tie detection)
  const candidateCount = priorities.filter(p => p === minPriority).length;
  if (candidateCount !== 1) return null;  // tie — fall through to next strategy

  const winnerIdx = priorities.indexOf(minPriority);
  const winner    = patches[winnerIdx];
  const domain    = domains[winnerIdx];

  return {
    winner,
    strategy:  "DOMAIN_PRIORITY",
    reasoning: `Domain "${domain}" has highest merge authority (priority=${minPriority})`,
  };
}

// ── Strategy 2: Confidence ────────────────────────────────────────────────────

function byConfidence(
  patches: FilePatch[],
): { winner: FilePatch; strategy: ResolutionStrategyName; reasoning: string } | null {
  const sorted = [...patches].sort((a, b) => b.confidence - a.confidence);
  if (sorted[0].confidence === (sorted[1]?.confidence ?? -1)) return null;  // tie
  return {
    winner:    sorted[0],
    strategy:  "CONFIDENCE",
    reasoning: `Highest confidence score: ${sorted[0].confidence.toFixed(3)}`,
  };
}

// ── Strategy 3: Content size ──────────────────────────────────────────────────

function byContentSize(
  patches: FilePatch[],
): { winner: FilePatch; strategy: ResolutionStrategyName; reasoning: string } {
  const sorted = [...patches].sort((a, b) =>
    (b.content?.length ?? 0) - (a.content?.length ?? 0)
  );
  return {
    winner:    sorted[0],
    strategy:  "CONTENT_SIZE",
    reasoning: `Largest content (${sorted[0].content?.length ?? 0} chars) selected`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export class ResolutionStrategy {
  /**
   * Resolve a single conflict to a winning patch.
   * Always returns a decision — never throws.
   */
  resolve(runId: string, conflict: SpecialistConflict): ResolutionDecision {
    const { filePath, patches, domains, type } = conflict;

    const result =
      byAstMerge(filePath, patches, type) ??
      byDomainPriority(patches, domains) ??
      byConfidence(patches) ??
      byContentSize(patches);

    const decision: ResolutionDecision = {
      filePath,
      winnerPatch:   result.winner,
      strategy:      result.strategy,
      rejectedCount: patches.length - 1,
      reasoning:     result.reasoning,
    };

    emitResolved(runId, decision);
    return decision;
  }

  /** Resolve all conflicts in a list. */
  resolveAll(runId: string, conflicts: SpecialistConflict[]): ResolutionDecision[] {
    return conflicts.map(c => this.resolve(runId, c));
  }
}

export const resolutionStrategy = new ResolutionStrategy();
