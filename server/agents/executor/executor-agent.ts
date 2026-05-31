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
import { memoryEngine, buildMemoryContext } from '../../memory/index.ts';
import { executionHistory }       from './memory/execution-history.ts';
import { failureMemory }          from './memory/failure-memory.ts';
import { learningStore }          from './learning/learning-store.ts';
export {
  dispatch,
  dispatchAll,
  dispatchSequential,
}                                 from '../../tools/registry/tool-dispatcher.ts';
export type { DispatchOptions }   from '../../tools/registry/tool-dispatcher.ts';

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

  // ── Phase 2: Memory Recall ────────────────────────────────────────────────
  // Recall relevant prior knowledge before execution begins.
  // Surfaces: past failures, tool reliability, execution patterns.
  // Non-blocking: recall failure must never prevent execution.
  const goalText = plan.tasks.map(t => t.taskId).join(' ');
  const [memCtx] = await Promise.all([
    buildMemoryContext(goalText, {
      categories: ['execution', 'bug', 'learning', 'reflection', 'decision'],
      limit:      10,
      minScore:   0.1,
    }).catch(() => null),
  ]);

  if (memCtx && memCtx.totalFound > 0) {
    executorLogger.info(runId, `[memory-recall] Prior context loaded — ${memCtx.totalFound} records, graph=${memCtx.hasGraphData}`, {
      categories:   [...new Set(memCtx.entries.map(e => e.category))],
      graphEntities: memCtx.graphEntities.length,
      durationMs:   memCtx.durationMs,
    });

    // Surface chronic failures to warn early
    const chronicFailures = failureMemory.chroniclePatterns();
    if (chronicFailures.length > 0) {
      executorLogger.warn(runId, `[memory-recall] ${chronicFailures.length} chronic failure pattern(s) detected from prior runs`, {
        patterns: chronicFailures.slice(0, 3).map(p => `${p.toolName}:${p.occurrences}x`),
      });
    }

    // Log top learned tool reliability scores
    const topReliable = learningStore.topByKind('tool-reliability', 3);
    if (topReliable.length > 0) {
      executorLogger.info(runId, '[memory-recall] Learned tool reliability', {
        tools: topReliable.map(e => `${e.key}=${e.value.toFixed(2)}`),
      });
    }

    // Log execution history summary
    const histSummary = executionHistory.summary();
    if (histSummary.totalRecorded > 0) {
      executorLogger.info(runId, '[memory-recall] Execution history', {
        total:       histSummary.totalRecorded,
        successRate: histSummary.successRate,
        avgRetries:  histSummary.avgRetries,
      });
    }
  }

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

    // Fire-and-forget: persist execution outcome to memory platform
    memoryEngine.store({
      category: 'execution',
      content:  JSON.stringify({ ok: result.ok, tasksCompleted: result.tasksCompleted, tasksFailed: result.tasksFailed, durationMs: result.durationMs }),
      tags:     ['executor', result.ok ? 'success' : 'failure'],
      score:    result.ok ? 1.0 : 0.2,
      meta:     { runId, projectId, agentSource: 'executor' },
    }).catch(console.error);

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
