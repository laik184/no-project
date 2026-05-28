/**
 * server/agents/executor/reasoning/decision-engine.ts
 *
 * Central autonomous reasoning engine for the executor agent.
 * Analyzes failures and execution context to decide what to do next:
 * retry / repair / rollback / switch-tool / validate / replan / escalate / abort.
 *
 * Purely deterministic — no LLM calls. Pattern matching + history analysis.
 * No tool imports. No execution. Read-only analysis.
 */

import type { TaskKind }         from '../types/executor.types.ts';
import { failureMemory }         from '../memory/failure-memory.ts';
import { executionHistory }      from '../memory/execution-history.ts';
import { executionStateMachine } from '../runtime/execution-state-machine.ts';

// ── Decision types ────────────────────────────────────────────────────────────

export type DecisionAction =
  | 'retry'
  | 'repair'
  | 'rollback'
  | 'switch-tool'
  | 'validate'
  | 'replan'
  | 'escalate'
  | 'abort';

export interface DecisionContext {
  runId:           string;
  taskId:          string;
  stepId:          string;
  toolName:        string;
  kind:            TaskKind;
  error:           string;
  attempt:         number;
  maxAttempts:     number;
  priorFixApplied?: string;
  workflowCritical: boolean;
}

export interface Decision {
  action:      DecisionAction;
  rationale:   string;
  confidence:  number;        // 0–1
  retryDelay?: number;        // ms, if action is 'retry'
  repairHint?: string;        // suggested patch/fix description
  alternativeTool?: string;   // if action is 'switch-tool'
}

// ── Decision flow ─────────────────────────────────────────────────────────────
//
//   error received
//     ↓ retries exhausted?  → check repair possibility
//     ↓ no → schedule retry with smarter delay
//     ↓ repair possible? → repair
//     ↓ rollback needed (file corruption, TS errors)? → rollback
//     ↓ alternative tool exists? → switch-tool
//     ↓ workflow critical? → escalate
//     ↓ else → abort

const ESCALATION_ERRORS  = [/security|permission|blocked/i, /infinite.*loop|recursion/i];
const ABORT_ERRORS       = [/missing.*required.*env/i, /invalid.*api.*key/i, /registry.*sealed/i];
const ROLLBACK_TRIGGERS  = [/ts\d{4}|cannot find|circular.*import|broken.*export/i, /syntax.*error/i];
const REPAIR_TRIGGERS    = [/type.*error|property.*does not exist|is not assignable/i, /import.*not.*found|module.*not.*found/i];
const TOOL_SWITCH_PAIRS: Record<string, string> = {
  'execute_coding_task':    'create_file',
  'apply_patch':            'write_file',
  'run_terminal_command':   'execute_bash',
};

function _confidence(base: number, attempts: number, maxAttempts: number): number {
  return Math.max(0.1, base - (attempts / maxAttempts) * 0.2);
}

// ── Engine ────────────────────────────────────────────────────────────────────

export const decisionEngine = {
  decide(ctx: DecisionContext): Decision {
    const {
      runId, toolName, kind, error, attempt, maxAttempts, workflowCritical,
    } = ctx;

    // 1. Always-abort on non-recoverable errors
    if (ABORT_ERRORS.some((re) => re.test(error))) {
      return { action: 'abort', rationale: `Non-recoverable error: ${error.slice(0, 80)}`, confidence: 0.95 };
    }

    // 2. Escalate on security/governance violations or after machine says ESCALATED
    if (ESCALATION_ERRORS.some((re) => re.test(error))) {
      return { action: 'escalate', rationale: `Governance/security violation: ${error.slice(0, 80)}`, confidence: 0.9 };
    }

    const smState = executionStateMachine.getState(runId);
    if (smState === 'ESCALATED') {
      return { action: 'escalate', rationale: 'Run already in ESCALATED state', confidence: 1.0 };
    }

    // 3. Check failure memory for chronic patterns
    const analysis      = failureMemory.analyze(runId, toolName, kind, error);
    const failureFreq   = analysis.pattern.occurrences;
    const retryStorm    = failureMemory.isRetryStorm();

    if (retryStorm) {
      return { action: 'escalate', rationale: 'Retry storm detected — too many failures in 30s', confidence: 0.9 };
    }

    if (analysis.isChronicle && workflowCritical) {
      return { action: 'escalate', rationale: `Chronic failure (${failureFreq}x) in critical workflow`, confidence: 0.85 };
    }

    // 4. Rollback on corrupting errors (TS errors, broken exports)
    if (ROLLBACK_TRIGGERS.some((re) => re.test(error))) {
      return {
        action:    'rollback',
        rationale: `Detected code corruption: ${error.slice(0, 80)}`,
        confidence: _confidence(0.8, attempt, maxAttempts),
      };
    }

    // 5. Repair on type/import errors where a prior fix exists
    if (REPAIR_TRIGGERS.some((re) => re.test(error))) {
      const priorFix = executionHistory.hasPriorFix(toolName, 'TYPE_ERROR');
      return {
        action:      'repair',
        rationale:   `Type/import error detected — repair pass required`,
        confidence:  _confidence(0.75, attempt, maxAttempts),
        repairHint:  priorFix ?? analysis.recommendation,
      };
    }

    // 6. Retries not exhausted → retry with adaptive delay
    if (attempt < maxAttempts) {
      const base      = 800;
      const retryDelay = Math.min(base * Math.pow(2, attempt - 1), 10_000);
      const similar   = executionHistory.findSimilarFailure(toolName, error);
      return {
        action:      'retry',
        rationale:   `Attempt ${attempt}/${maxAttempts} — ${similar ? 'similar prior failure found' : 'standard backoff'}`,
        confidence:  _confidence(0.7, attempt, maxAttempts),
        retryDelay,
      };
    }

    // 7. Retries exhausted — try tool switch
    const alt = TOOL_SWITCH_PAIRS[toolName];
    if (alt) {
      return {
        action:          'switch-tool',
        rationale:       `All ${maxAttempts} attempts failed — switching to ${alt}`,
        confidence:      0.5,
        alternativeTool: alt,
      };
    }

    // 8. Escalate on critical workflows, abort otherwise
    if (workflowCritical) {
      return { action: 'escalate', rationale: `Retries exhausted on critical workflow task`, confidence: 0.8 };
    }

    return { action: 'abort', rationale: `Retries exhausted and no recovery path found`, confidence: 0.6 };
  },

  /** Decide whether a completed task output is worth revalidating. */
  shouldValidate(toolName: string, output: unknown): boolean {
    if (!output) return false;
    const coding = ['execute_coding_task', 'apply_patch', 'write_file', 'create_file'];
    return coding.includes(toolName);
  },

  /** Decide if a replan is warranted given state. */
  shouldReplan(runId: string, failedTaskCount: number, totalTasks: number): boolean {
    if (totalTasks === 0) return false;
    const failRate = failedTaskCount / totalTasks;
    const state    = executionStateMachine.getState(runId);
    return failRate >= 0.5 || state === 'RECOVERING';
  },
};
