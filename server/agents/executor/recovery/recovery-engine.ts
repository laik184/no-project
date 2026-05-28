/**
 * server/agents/executor/recovery/recovery-engine.ts
 *
 * Runtime recovery orchestration for the executor agent.
 * Coordinates: decision-engine → rollback-manager → self-healing-loop
 * to recover from timeout, browser restart, patch failure, validation
 * failure, dead execution, and retry exhaustion scenarios.
 *
 * Does NOT dispatch tools directly. Produces RecoveryPlan consumed by callers.
 */

import { decisionEngine }         from '../reasoning/decision-engine.ts';
import { rollbackManager }        from './rollback-manager.ts';
import { executionStateMachine }  from '../runtime/execution-state-machine.ts';
import { executionTimeline }      from '../telemetry/execution-timeline.ts';
import { executionHistory }       from '../memory/execution-history.ts';
import { failureMemory }          from '../memory/failure-memory.ts';
import type { TaskKind }          from '../types/executor.types.ts';
import type { DecisionAction }    from '../reasoning/decision-engine.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecoveryType =
  | 'timeout'
  | 'browser-restart'
  | 'patch-recovery'
  | 'validation-recovery'
  | 'workflow-recovery'
  | 'dead-execution'
  | 'retry-exhaustion';

export interface RecoveryContext {
  runId:           string;
  taskId:          string;
  stepId:          string;
  toolName:        string;
  kind:            TaskKind;
  error:           string;
  attempt:         number;
  maxAttempts:     number;
  workflowCritical: boolean;
}

export interface RecoveryPlan {
  ok:          boolean;
  action:      DecisionAction;
  recoveryType: RecoveryType;
  rationale:   string;
  confidence:  number;
  retryDelay?: number;
  rollbackFiles?: string[];
  repairHint?: string;
  alternativeTool?: string;
  shouldEscalate: boolean;
}

// ── Recovery type inference ───────────────────────────────────────────────────

function _inferRecoveryType(error: string, kind: TaskKind): RecoveryType {
  if (/timeout|timed out/i.test(error))           return 'timeout';
  if (/browser|playwright|navigation/i.test(error)) return 'browser-restart';
  if (/ts\d{4}|type.*error|broken.*export/i.test(error)) return 'patch-recovery';
  if (/validation|invalid.*input/i.test(error))   return 'validation-recovery';
  if (kind === 'verify')                           return 'validation-recovery';
  if (/dead|unresponsive|stuck/i.test(error))      return 'dead-execution';
  return 'retry-exhaustion';
}

// ── Engine ────────────────────────────────────────────────────────────────────

export const recoveryEngine = {
  /**
   * Assess a failure and produce a recovery plan.
   * All callers (step-runner integration, self-healing-loop) consume this plan.
   */
  assess(ctx: RecoveryContext): RecoveryPlan {
    const { runId, taskId, kind, toolName, error, attempt, maxAttempts, workflowCritical } = ctx;

    // Record in telemetry
    executionTimeline.record(runId, 'recovery.started', `Assessing failure: ${error.slice(0, 60)}`);

    // Get autonomous decision
    const decision = decisionEngine.decide({
      runId, taskId, stepId: ctx.stepId, toolName, kind, error,
      attempt, maxAttempts, workflowCritical,
    });

    const recoveryType = _inferRecoveryType(error, kind);

    // For rollback/repair actions, capture files to restore
    let rollbackFiles: string[] | undefined;
    if (decision.action === 'rollback') {
      const cp      = rollbackManager.latestCheckpoint(runId);
      rollbackFiles = rollbackManager.filesSinceCheckpoint(runId);
      rollbackManager.rollback(runId, kind, `recovery-engine: ${error.slice(0, 60)}`);
    }

    // Record recovery attempt
    executionHistory.recordExecution({
      runId, taskId, toolName, kind,
      outcome:    'partial',
      errorText:  error,
      retries:    attempt,
      durationMs: 0,
      fixApplied: `${decision.action}:${recoveryType}`,
    });

    // Analyse failure pattern
    failureMemory.recordFailurePattern(runId, toolName, kind, error);

    // Transition state machine
    executionStateMachine.tryTransition(runId, 'RECOVERING', `recovery-engine: ${decision.action}`);

    const plan: RecoveryPlan = {
      ok:             decision.action !== 'abort',
      action:         decision.action,
      recoveryType,
      rationale:      decision.rationale,
      confidence:     decision.confidence,
      retryDelay:     decision.retryDelay,
      rollbackFiles,
      repairHint:     decision.repairHint,
      alternativeTool: decision.alternativeTool,
      shouldEscalate: decision.action === 'escalate',
    };

    const outcome = plan.ok ? 'recovery.completed' : 'recovery.failed';
    executionTimeline.record(
      runId, outcome,
      `Recovery plan: ${decision.action} — ${decision.rationale.slice(0, 60)}`,
    );

    return plan;
  },

  /**
   * Check if a run is in a recoverable state.
   * Returns false if already ESCALATED/CANCELLED/COMPLETED.
   */
  canRecover(runId: string): boolean {
    const state = executionStateMachine.getState(runId);
    if (!state) return false;
    return !['ESCALATED', 'CANCELLED', 'COMPLETED'].includes(state);
  },

  /**
   * Mark recovery as resolved — transition back to EXECUTING.
   */
  resolveRecovery(runId: string): void {
    executionStateMachine.tryTransition(runId, 'EXECUTING', 'recovery resolved');
  },

  /**
   * Escalate a run to human review.
   */
  escalate(runId: string, reason: string): void {
    executionStateMachine.tryTransition(runId, 'ESCALATED', reason);
    executionTimeline.record(runId, 'escalation.triggered', reason);
    console.warn(`[recovery-engine] Escalated run ${runId}: ${reason}`);
  },
};
