/**
 * server/agents/coderx/execution/coding-loop.ts
 *
 * MAIN coding runtime loop.
 * Controls the full coding lifecycle: analyze → plan → implement → execute.
 * Coordinates retries, execution sequencing, and reasoning flow.
 * No direct tool calls — delegates to task-executor and planning layers.
 */

import type {
  CodingRequest,
  CoderXAgentResult,
  CoderXExecutionContext,
  CoderXLoopOptions,
  CoderXRetryConfig,
} from '../types/coderx.types.ts';
import { DEFAULT_RETRY_CONFIG }       from './retry-manager.ts';
import { executeTasks }               from './task-executor.ts';
import { buildCodingPlan }            from '../planning/code-planner.ts';
import { buildImplementationPlan }    from '../planning/implementation-planner.ts';
import { buildExecutionPlan }         from '../planning/execution-plan-builder.ts';
import { analyzeCodingTask }          from '../reasoning/task-analyzer.ts';
import { buildDependencyGraph }       from '../reasoning/dependency-analyzer.ts';
import { shouldAbortPlan }            from '../reasoning/decision-engine.ts';
import { advanceSession, completeSession, failSession, incrementTaskDone } from '../core/coderx-session.ts';
import { workingMemory }              from '../memory/working-memory.ts';
import { coderxLogger }               from '../telemetry/coderx-logger.ts';
import { coderxMetrics }              from '../telemetry/coderx-metrics.ts';
import { assertNonEmptyPlan }         from '../validation/integrity-validator.ts';
import { assertValidCodingRequest }   from '../validation/coding-validator.ts';
import { elapsedMs, now }             from '../utils/coding-utils.ts';

export async function runCodingLoop(
  request:   CodingRequest,
  context:   CoderXExecutionContext,
  sessionId: string,
  opts:      CoderXLoopOptions = {},
): Promise<CoderXAgentResult> {
  const startedAt    = now();
  const retryConfig: CoderXRetryConfig = opts.retry ?? DEFAULT_RETRY_CONFIG;
  const stopOnFail   = opts.stopOnFailure ?? false;

  // ── Validate request ──────────────────────────────────────────────────────
  assertValidCodingRequest(request);

  // ── Phase 1: Analyze ──────────────────────────────────────────────────────
  advanceSession(sessionId, 'analyzing');
  const analysis = analyzeCodingTask(request);
  workingMemory.setAnalysis(context.runId, analysis);

  // ── Phase 2: Plan ─────────────────────────────────────────────────────────
  advanceSession(sessionId, 'planning');
  const codingPlan = buildCodingPlan(request);
  workingMemory.setPlan(context.runId, codingPlan);

  // ── Validate dependency graph ─────────────────────────────────────────────
  const depGraph = buildDependencyGraph(codingPlan.tasks);
  if (depGraph.hasCycle) {
    failSession(sessionId);
    return buildErrorResult(context, sessionId, startedAt, 'Dependency cycle detected in coding plan.');
  }

  // ── Build implementation strategy ─────────────────────────────────────────
  const implPlan = buildImplementationPlan(codingPlan);
  const execPlan = buildExecutionPlan(codingPlan, implPlan);

  assertNonEmptyPlan(execPlan.totalSteps);
  coderxLogger.planBuilt(context.runId, execPlan.planId, execPlan.totalSteps);
  coderxMetrics.initRun(context.runId);

  // ── Phase 3: Execute ──────────────────────────────────────────────────────
  advanceSession(sessionId, 'executing');
  const result = await executeTasks(
    codingPlan.tasks,
    context,
    retryConfig,
    stopOnFail,
  );

  // ── Finalize ──────────────────────────────────────────────────────────────
  for (const output of result.outputs) {
    if (output.ok) incrementTaskDone(sessionId);
  }

  const abort      = result.shouldAbort ||
    shouldAbortPlan(result.tasksFailed, execPlan.totalSteps, stopOnFail);
  const allOk      = result.tasksFailed === 0 && !abort;
  const durationMs = elapsedMs(startedAt);

  if (allOk) {
    completeSession(sessionId);
  } else {
    failSession(sessionId);
  }

  coderxMetrics.finalizeRun(context.runId, allOk);

  return {
    ok:             allOk,
    runId:          context.runId,
    sessionId,
    requestId:      context.requestId,
    tasksTotal:     execPlan.totalSteps,
    tasksCompleted: result.outputs.filter((o) => o.ok).length,
    tasksFailed:    result.tasksFailed,
    durationMs,
    outputs:        result.outputs,
    error:          allOk ? undefined : `${result.tasksFailed} task(s) failed.`,
  };
}

// ── Error result builder ──────────────────────────────────────────────────────

function buildErrorResult(
  context:   CoderXExecutionContext,
  sessionId: string,
  startedAt: Date,
  error:     string,
): CoderXAgentResult {
  return {
    ok:             false,
    runId:          context.runId,
    sessionId,
    requestId:      context.requestId,
    tasksTotal:     0,
    tasksCompleted: 0,
    tasksFailed:    0,
    durationMs:     elapsedMs(startedAt),
    outputs:        [],
    error,
  };
}
