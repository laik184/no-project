/**
 * resolution-strategy.ts
 *
 * Selects a winning patch for each conflict using a prioritised strategy chain.
 * Single responsibility: conflict → resolution decision.
 *
 * Strategy chain (first match wins):
 *   1. DOMAIN_PRIORITY — lowest DOMAIN_MERGE_PRIORITY number wins
 *   2. CONFIDENCE      — highest confidence score wins
 *   3. CONTENT_SIZE    — largest content wins (most complete patch)
 *   4. FIRST_WRITER    — first patch in the array wins (deterministic fallback)
 */

import type { SpecialistConflict } from "./specialist-conflict-detector.ts";
import type { FilePatch }           from "../contracts/specialist.contracts.ts";
import { DOMAIN_MERGE_PRIORITY, type SpecialistDomain }
  from "../contracts/specialist.contracts.ts";
import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResolutionStrategyName =
  | "DOMAIN_PRIORITY"
  | "CONFIDENCE"
  | "CONTENT_SIZE"
  | "FIRST_WRITER";

export interface ResolutionDecision {
  filePath:          string;
  winnerPatch:       FilePatch;
  strategy:          ResolutionStrategyName;
  rejectedCount:     number;
  reasoning:         string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emitResolved(runId: string, decision: ResolutionDecision): void {
  bus.emit("agent.event", {
    runId,
    phase:     "coordination",
    agentName: "resolution-strategy",
    eventType: "conflict.resolved",
    payload:   {
      filePath:  decision.filePath,
      strategy:  decision.strategy,
      reasoning: decision.reasoning,
    },
    ts: Date.now(),
  });
}

// ── Strategy implementations ──────────────────────────────────────────────────

function byDomainPriority(
  patches: FilePatch[],
  domains: SpecialistDomain[],
): { winner: FilePatch; strategy: ResolutionStrategyName; reasoning: string } | null {
  let best: FilePatch | null    = null;
  let bestPriority              = Infinity;
  let bestDomain: SpecialistDomain = "fullstack";

  for (let i = 0; i < patches.length; i++) {
    const domain   = domains[i] ?? "fullstack";
    const priority = DOMAIN_MERGE_PRIORITY[domain] ?? 99;
    if (priority < bestPriority) {
      bestPriority = priority;
      best         = patches[i];
      bestDomain   = domain;
    }
  }

  if (!best) return null;
  const hasTie = domains.filter((d, i) => patches[i] !== best &&
    DOMAIN_MERGE_PRIORITY[d] === bestPriority).length > 0;
  if (hasTie) return null; // tie — fall through to next strategy

  return {
    winner:    best,
    strategy:  "DOMAIN_PRIORITY",
    reasoning: `Domain "${bestDomain}" has highest merge priority (${bestPriority})`,
  };
}

function byConfidence(patches: FilePatch[]): { winner: FilePatch; strategy: ResolutionStrategyName; reasoning: string } | null {
  const sorted = [...patches].sort((a, b) => b.confidence - a.confidence);
  if (sorted[0].confidence === sorted[1]?.confidence) return null; // tie
  return {
    winner:    sorted[0],
    strategy:  "CONFIDENCE",
    reasoning: `Highest confidence score: ${sorted[0].confidence.toFixed(2)}`,
  };
}

function byContentSize(patches: FilePatch[]): { winner: FilePatch; strategy: ResolutionStrategyName; reasoning: string } {
  const sorted = [...patches].sort((a, b) =>
    (b.content?.length ?? 0) - (a.content?.length ?? 0)
  );
  return {
    winner:    sorted[0],
    strategy:  "CONTENT_SIZE",
    reasoning: `Largest content selected (${sorted[0].content?.length ?? 0} chars)`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export class ResolutionStrategy {
  /**
   * Resolve a single conflict to a winning patch.
   * Always returns a decision — never throws.
   */
  resolve(
    runId:    string,
    conflict: SpecialistConflict,
  ): ResolutionDecision {
    const { filePath, patches, domains } = conflict;

    const result =
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

  /** Resolve all conflicts in a report. */
  resolveAll(
    runId:     string,
    conflicts: SpecialistConflict[],
  ): ResolutionDecision[] {
    return conflicts.map(c => this.resolve(runId, c));
  }
}

export const resolutionStrategy = new ResolutionStrategy();
