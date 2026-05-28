/**
 * server/agents/executor/learning/execution-scorer.ts
 *
 * Quantifies execution quality for learning feedback.
 * Pure scoring math — no side effects, no I/O.
 */

import type { TaskKind } from '../types/executor.types.ts';

// ── Input / Output ────────────────────────────────────────────────────────────

export interface ExecutionScoringInput {
  runId:             string;
  totalTasks:        number;
  successfulTasks:   number;
  failedTasks:       number;
  totalRetries:      number;
  recoveryUsed:      boolean;
  rollbackCount:     number;
  escalated:         boolean;
  validationsPassed: number;
  validationsFailed: number;
  parallelWaves:     number;
  sequentialSteps:   number;
  estimatedDurationMs: number;
  actualDurationMs:    number;
  taskKinds:         TaskKind[];
}

export interface ExecutionQualityScore {
  executionScore:      number;   // 0–100 overall
  reliabilityScore:    number;   // 0–100 task success rate
  recoveryScore:       number;   // 0–100 how clean the execution was
  workflowEfficiency:  number;   // 0–100 speed / parallelism quality
  feedbackDelta:       number;   // [-0.2, +0.2] normalized for learning store
  grade:               'A' | 'B' | 'C' | 'D' | 'F';
  breakdown:           Record<string, number>;
}

// ── Weights ───────────────────────────────────────────────────────────────────

const W = {
  retryPenalty:       -3,    // per retry
  failurePenalty:     -10,   // per failed task
  rollbackPenalty:    -8,    // per rollback
  escalationPenalty:  -20,   // flat if escalated
  validationBonus:    +5,    // per validation passed
  parallelBonus:      +4,    // per parallel wave used
  zeroRetryBonus:     +10,   // bonus for clean zero-retry run
  zeroFailureBonus:   +15,   // bonus for zero failures
};

// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreExecution(input: ExecutionScoringInput): ExecutionQualityScore {
  const base = 100;

  const retryPenalty      = input.totalRetries        * W.retryPenalty;
  const failurePenalty    = input.failedTasks          * W.failurePenalty;
  const rollbackPenalty   = input.rollbackCount        * W.rollbackPenalty;
  const escalationPenalty = input.escalated            ? W.escalationPenalty : 0;
  const validationBonus   = input.validationsPassed    * W.validationBonus;
  const parallelBonus     = input.parallelWaves        * W.parallelBonus;
  const zeroRetryBonus    = input.totalRetries === 0   ? W.zeroRetryBonus    : 0;
  const zeroFailureBonus  = input.failedTasks  === 0   ? W.zeroFailureBonus  : 0;

  const rawScore = base
    + retryPenalty + failurePenalty + rollbackPenalty + escalationPenalty
    + validationBonus + parallelBonus + zeroRetryBonus + zeroFailureBonus;

  const executionScore = Math.min(100, Math.max(0, rawScore));

  // Reliability score — task completion rate
  const totalTasks = Math.max(1, input.totalTasks);
  const reliabilityScore = Math.round((input.successfulTasks / totalTasks) * 100);

  // Recovery score — penalise each recovery action
  const recoveryPenalty = (input.recoveryUsed ? 20 : 0)
    + (input.rollbackCount * 10)
    + (input.escalated ? 40 : 0);
  const recoveryScore = Math.max(0, 100 - recoveryPenalty);

  // Workflow efficiency — parallelism + duration accuracy
  const durationRatio = input.estimatedDurationMs > 0
    ? input.actualDurationMs / input.estimatedDurationMs
    : 1.0;
  const durationPenalty = durationRatio > 2 ? 30 : durationRatio > 1.5 ? 15 : 0;
  const parallelRatio = input.parallelWaves > 0
    ? input.parallelWaves / (input.parallelWaves + input.sequentialSteps + 1)
    : 0;
  const workflowEfficiency = Math.round(
    Math.max(0, 70 + parallelRatio * 30 - durationPenalty),
  );

  // Feedback delta — normalised [-0.2, +0.2] for learning store
  const feedbackDelta = (executionScore - 50) / 250;

  // Grade
  let grade: ExecutionQualityScore['grade'];
  if (executionScore >= 90) grade = 'A';
  else if (executionScore >= 75) grade = 'B';
  else if (executionScore >= 60) grade = 'C';
  else if (executionScore >= 45) grade = 'D';
  else grade = 'F';

  return {
    executionScore:     Math.round(executionScore),
    reliabilityScore:   Math.round(reliabilityScore),
    recoveryScore:      Math.round(recoveryScore),
    workflowEfficiency: Math.round(workflowEfficiency),
    feedbackDelta,
    grade,
    breakdown: {
      base, retryPenalty, failurePenalty, rollbackPenalty, escalationPenalty,
      validationBonus, parallelBonus, zeroRetryBonus, zeroFailureBonus,
    },
  };
}

/** Summarise a score into a human-readable string for telemetry. */
export function summariseScore(s: ExecutionQualityScore): string {
  return `Grade ${s.grade} | exec=${s.executionScore} reliability=${s.reliabilityScore} ` +
         `recovery=${s.recoveryScore} efficiency=${s.workflowEfficiency}`;
}
