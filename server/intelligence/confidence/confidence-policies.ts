/**
 * confidence-policies.ts
 *
 * Declarative policy evaluation engine.
 * Each policy is a named rule that inspects a confidence record
 * and returns a penalty / state mutation / block decision.
 *
 * Policies are evaluated in priority order after every execution.
 * NO policy may grant a success bypass of verification gates.
 */

import type {
  AgentConfidenceRecord,
  PolicyEvaluationResult,
  ConfidenceState,
} from "./confidence-types.ts";
import { HALLUCINATION, POLICY, scoreToState } from "./confidence-thresholds.ts";
import {
  blockAgent,
  updateConfidenceScore,
  getConfidenceState,
  incrementPolicyViolations,
} from "./stores/confidence-store.ts";
import { emitPolicyViolated, emitConfidenceBlocked } from "./confidence-events.ts";

// ── Policy definition ─────────────────────────────────────────────────────────

interface Policy {
  id:       string;
  priority: number;     // lower = evaluated first
  check:    (record: AgentConfidenceRecord) => string | null;  // returns violation message or null
  penalty:  number;     // added to existing penalties
  block:    boolean;    // if true, agent is blocked immediately
}

// ── Policy catalogue ──────────────────────────────────────────────────────────

const POLICIES: Policy[] = [
  {
    id:       "hallucination-hard-block",
    priority: 1,
    check:    r => r.hallucinationRisk >= HALLUCINATION.HARD_BLOCK_THRESHOLD
      ? `Hallucination risk ${(r.hallucinationRisk * 100).toFixed(0)}% exceeds hard-block threshold`
      : null,
    penalty:  0.50,
    block:    true,
  },
  {
    id:       "hallucination-degraded",
    priority: 2,
    check:    r => r.hallucinationRisk >= HALLUCINATION.DEGRADED_THRESHOLD
      ? `Hallucination risk ${(r.hallucinationRisk * 100).toFixed(0)}% forces DEGRADED state`
      : null,
    penalty:  0.20,
    block:    false,
  },
  {
    id:       "repeated-runtime-crashes",
    priority: 3,
    check:    r => r.runtimeFailures >= 5
      ? `${r.runtimeFailures} runtime failures in single execution`
      : null,
    penalty:  0.15,
    block:    false,
  },
  {
    id:       "excessive-retries",
    priority: 4,
    check:    r => r.retries >= 4
      ? `Excessive retry count: ${r.retries}`
      : null,
    penalty:  0.10,
    block:    false,
  },
  {
    id:       "verification-never-passed",
    priority: 5,
    check:    r => !r.verificationPassed && r.finalOutcome === "FAILED"
      ? "Verification never passed and execution marked FAILED"
      : null,
    penalty:  0.20,
    block:    false,
  },
  {
    id:       "max-policy-violations",
    priority: 6,
    check:    r => r.policyViolations >= POLICY.BLOCK_AFTER_VIOLATIONS
      ? `Policy violation count ${r.policyViolations} exceeds hard limit`
      : null,
    penalty:  0.30,
    block:    true,
  },
  {
    id:       "reward-consistent-verification",
    priority: 10,
    check:    r => r.verificationPassed && r.hallucinationRisk < 0.10 ? "REWARD" : null,
    penalty:  -0.05,   // negative = reward (score increase)
    block:    false,
  },
].sort((a, b) => a.priority - b.priority);

// ── Evaluator ─────────────────────────────────────────────────────────────────

export function evaluatePolicies(record: AgentConfidenceRecord): PolicyEvaluationResult {
  const violations: string[] = [];
  let   totalPenalty = 0;
  let   shouldBlock  = false;

  for (const policy of POLICIES) {
    const violation = policy.check(record);
    if (!violation) continue;

    if (violation !== "REWARD") {
      violations.push(`[${policy.id}] ${violation}`);
      incrementPolicyViolations(record.agentId);
    }

    totalPenalty += policy.penalty;

    if (policy.block) {
      shouldBlock = true;
    }
  }

  // Apply penalties to score
  const newScore      = Math.max(0, Math.min(1, record.confidenceScore - totalPenalty));
  let   newState: ConfidenceState = shouldBlock ? "BLOCKED" : scoreToState(newScore);

  // Commit to store
  if (shouldBlock) {
    blockAgent(record.agentId, record.runId);
    emitConfidenceBlocked(record.runId, record.agentId,
      violations.join(" | ") || "Policy block");
  } else if (Math.abs(newScore - record.confidenceScore) > 0.001) {
    updateConfidenceScore(record.agentId, newScore, newState, Date.now());
  }

  if (violations.length > 0) {
    emitPolicyViolated(record.runId, record.agentId, violations, totalPenalty);
  }

  const prevState = getConfidenceState(record.agentId);
  return {
    agentId:          record.agentId,
    runId:            record.runId,
    violationsFound:  violations,
    penaltyApplied:   totalPenalty,
    stateTransition:  newState !== prevState ? newState : undefined,
    blocked:          shouldBlock,
  };
}
