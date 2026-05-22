/**
 * conflict-confidence-resolver.ts
 *
 * Resolves conflicts when 2+ agents attempt to modify the same file.
 * Decision is deterministic: higher confidence + lower hallucination wins.
 * Falls back to supervisor arbitration signal when scores are too close.
 * Emits telemetry on every resolution.
 */

import type { ConflictResolutionResult } from "./confidence-types.ts";
import { getConfidence } from "./stores/confidence-store.ts";
import { compareForConflict } from "./confidence-scorer.ts";
import { emitConflictResolved } from "./confidence-events.ts";
import { RELIABILITY } from "./confidence-thresholds.ts";

// ── Tie-break threshold ───────────────────────────────────────────────────────

const TIE_THRESHOLD = 0.05;   // scores within 5% → supervisor arbitration

// ── Input contract ────────────────────────────────────────────────────────────

export interface ConflictInput {
  agentA:   string;
  agentB:   string;
  filePath: string;
  runId:    string;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

export function resolveConflict(input: ConflictInput): ConflictResolutionResult {
  const { agentA, agentB, filePath, runId } = input;

  const recA = getConfidence(agentA);
  const recB = getConfidence(agentB);

  // Use INITIAL_SCORE as fallback for unregistered agents
  const scoreA         = recA?.confidenceScore   ?? RELIABILITY.INITIAL_SCORE;
  const scoreB         = recB?.confidenceScore   ?? RELIABILITY.INITIAL_SCORE;
  const hallA          = recA?.hallucinationRisk ?? 0;
  const hallB          = recB?.hallucinationRisk ?? 0;
  const verA           = recA?.verificationPassed ?? false;
  const verB           = recB?.verificationPassed ?? false;

  // One agent is BLOCKED — auto-lose
  if (recA?.state === "BLOCKED" && recB?.state !== "BLOCKED") {
    return _resolve(agentB, agentA, filePath, runId, "Agent A is BLOCKED", false);
  }
  if (recB?.state === "BLOCKED" && recA?.state !== "BLOCKED") {
    return _resolve(agentA, agentB, filePath, runId, "Agent B is BLOCKED", false);
  }

  // Deterministic comparison
  const comparison = compareForConflict(scoreA, hallA, verA, scoreB, hallB, verB);

  // Scores too close — request supervisor arbitration
  const scoreDiff = Math.abs(scoreA - scoreB);
  if (scoreDiff <= TIE_THRESHOLD && comparison === 0) {
    // Arbitrated — still need to return a winner; pick A as default
    return _resolve(agentA, agentB, filePath, runId,
      `Scores tied (diff=${scoreDiff.toFixed(3)}) — supervisor arbitration required`,
      true);
  }

  if (comparison > 0) {
    return _resolve(agentA, agentB, filePath, runId,
      `Agent A wins: score=${scoreA.toFixed(3)} hall=${hallA.toFixed(3)} ver=${verA}`, false);
  }

  return _resolve(agentB, agentA, filePath, runId,
    `Agent B wins: score=${scoreB.toFixed(3)} hall=${hallB.toFixed(3)} ver=${verB}`, false);
}

function _resolve(
  winner:     string,
  loser:      string,
  filePath:   string,
  runId:      string,
  reason:     string,
  arbitrated: boolean,
): ConflictResolutionResult {
  const result: ConflictResolutionResult = {
    winnerAgentId: winner,
    loserAgentId:  loser,
    filePath,
    reason,
    arbitrated,
  };
  emitConflictResolved(result, runId);
  return result;
}

// ── Multi-agent conflict (>2 agents) ─────────────────────────────────────────

export interface MultiConflictInput {
  agents:   string[];
  filePath: string;
  runId:    string;
}

export function resolveMultiConflict(input: MultiConflictInput): string {
  const { agents, filePath, runId } = input;
  if (agents.length === 0) throw new Error("resolveMultiConflict: agents array is empty");
  if (agents.length === 1) return agents[0];

  // Tournament: reduce list by pairwise comparison
  let winner = agents[0];
  for (let i = 1; i < agents.length; i++) {
    const result = resolveConflict({ agentA: winner, agentB: agents[i], filePath, runId });
    winner = result.winnerAgentId;
  }
  return winner;
}
