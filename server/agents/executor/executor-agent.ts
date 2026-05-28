/**
 * server/agents/executor/executor-agent.ts
 *
 * Public entry point for the executor agent.
 *
 * Responsibilities (orchestration only):
 *   - validate agent input
 *   - build execution context and session
 *   - plan execution via execution-planner
 *   - delegate to the execution loop
 *   - manage session and monitor lifecycle
 *   - return aggregated ExecutorAgentResult
 *
 * NO spawn(), exec(), fs calls, or direct tool invocations.
 * ALL execution flows through: loop → task-executor → step-runner
 *   → execution-routing → dispatcher-client → central dispatcher.
 */

import type { ExecutorAgentInput, ExecutorAgentResult } from './types/executor.types.ts';
import { buildExecutorContext }   from './core/executor-context.ts';
import {
  createSession,
  startSession,
  completeSession,
  failSession,
  removeSession,
  listActiveSessions,
}                                 from './core/executor-session.ts';
import { resetState }             from './core/executor-state.ts';
import { planExecution }          from './planning/execution-planner.ts';
import { runExecutionLoop }       from './execution/execution-loop.ts';
import { assertAgentInput }       from './validation/execution-validator.ts';
import { executorLogger }         from './telemetry/executor-logger.ts';
import { executorMetrics }        from './telemetry/executor-metrics.ts';
import { failureMonitor }         from './monitoring/failure-monitor.ts';
import { executionMonitor }       from './monitoring/execution-monitor.ts';
import { elapsedMs, toErrorMessage } from './utils/execution-utils.ts';

// ── Initialization guard ──────────────────────────────────────────────────────

let _initialized = false;

export function initializeExecutor(): void {
  if (_initialized) return;
  _initialized = true;
  console.log('[executor-agent] Initialized — orchestration layer ready');
}

export function shutdownExecutor(): void {
  const active = listActiveSessions();
  if (active.length > 0) {
    console.warn(`[executor-agent] Shutting down with ${active.length} active session(s)`);
  }
  _initialized = false;
  console.log('[executor-agent] Shutdown complete');
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Execute a full agent run.
 *
 * validate → context → session → plan → loop → teardown → result
 *
 * Never throws — errors are captured in the result envelope.
 */
export async function runExecutorAgent(
  input: ExecutorAgentInput,
): Promise<ExecutorAgentResult> {
  if (!_initialized) initializeExecutor();

  const startedAt = new Date();

  // ── Validate input ────────────────────────────────────────────────────────
  try {
    assertAgentInput(input);
  } catch (err) {
    const error = toErrorMessage(err);
    executorLogger.error(input.runId ?? 'unknown', `Input validation failed: ${error}`);
    return failResult('unknown', 'unknown', 0, error, elapsedMs(startedAt));
  }

  const { runId, projectId, sandboxRoot, plan, options = {} } = input;

  // ── Build context ─────────────────────────────────────────────────────────
  let context;
  try {
    context = buildExecutorContext({ runId, projectId, sandboxRoot });
  } catch (err) {
    const error = toErrorMessage(err);
    executorLogger.error(runId, `Context build failed: ${error}`);
    return failResult(runId, 'unknown', plan.tasks.length, error, elapsedMs(startedAt));
  }

  // ── Plan execution ────────────────────────────────────────────────────────
  const planResult = planExecution(plan, runId, sandboxRoot);
  if (!planResult.ok || !planResult.plan) {
    const error = planResult.error ?? 'Plan building failed';
    executorLogger.error(runId, `Planning failed: ${error}`);
    return failResult(runId, context.sessionId, plan.tasks.length, error, elapsedMs(startedAt));
  }

  const builtPlan = planResult.plan;

  // ── Session lifecycle ─────────────────────────────────────────────────────
  const session = createSession(runId, projectId, plan.tasks.length);

  // Attach session ID to context
  const ctxWithSession = { ...context, sessionId: session.sessionId };

  startSession(session.sessionId);
  resetState();
  executionMonitor.register(runId, session.sessionId, plan.tasks.length);

  executorLogger.info(runId, `Agent run started`, {
    sessionId:  session.sessionId,
    planId:     builtPlan.planId,
    totalSteps: builtPlan.totalSteps,
  });

  try {
    // Build ordered task list from the plan (preserves dependency order)
    const orderedTasks = builtPlan.steps.map((step) => {
      return plan.tasks.find((t) => t.taskId === step.taskId)!;
    }).filter(Boolean);

    const result = await runExecutionLoop(orderedTasks, ctxWithSession, options);

    if (result.ok) completeSession(session.sessionId);
    else           failSession(session.sessionId);

    executorLogger.info(runId, `Agent run complete — ok=${result.ok}`, {
      sessionId:      session.sessionId,
      tasksCompleted: result.tasksCompleted,
      tasksFailed:    result.tasksFailed,
      durationMs:     result.durationMs,
    });

    return result;

  } catch (err) {
    const error = toErrorMessage(err);
    failSession(session.sessionId);
    executorLogger.sessionFailed(runId, session.sessionId, error);
    return failResult(runId, session.sessionId, plan.tasks.length, error, elapsedMs(startedAt));

  } finally {
    removeSession(session.sessionId);
    executionMonitor.deregister(runId);
  }
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function getExecutorDiagnostics(): {
  activeSessions: number;
  metrics:        ReturnType<typeof executorMetrics.snapshot>;
  failures:       ReturnType<typeof failureMonitor.summary>;
  executions:     ReturnType<typeof executionMonitor.allSnapshots>;
} {
  return {
    activeSessions: listActiveSessions().length,
    metrics:        executorMetrics.snapshot(),
    failures:       failureMonitor.summary(),
    executions:     executionMonitor.allSnapshots(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function failResult(
  runId:      string,
  sessionId:  string,
  total:      number,
  error:      string,
  durationMs: number,
): ExecutorAgentResult {
  return {
    ok:             false,
    runId,
    sessionId,
    tasksTotal:     total,
    tasksCompleted: 0,
    tasksFailed:    total,
    durationMs,
    outputs:        [],
    error,
  };
}
