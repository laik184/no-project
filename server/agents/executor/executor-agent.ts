import type { ExecutorInput, ExecutorResult }         from './types.ts';
import { runExecutorEngine }                          from './engine.ts';
import { createSession, startSession, completeSession, failSession, removeSession, listActiveSessions } from './session.ts';
import { registerExecutorEventHandlers, unregisterExecutorEventHandlers } from './events.ts';
import { safeValidateExecutorInput }                  from './utils.ts';
import { executorLogger }                             from './telemetry.ts';
import { elapsedMs }                                  from './utils.ts';

let _initialized = false;

export function initializeExecutor(): void {
  if (_initialized) return;
  registerExecutorEventHandlers();
  _initialized = true;
  console.log('[executor-agent] Initialized — event handlers registered');
}

export async function executeTask(raw: unknown): Promise<ExecutorResult> {
  if (!_initialized) initializeExecutor();

  const validated = safeValidateExecutorInput(raw);
  if (!validated.ok) {
    return {
      ok:             false,
      runId:          (raw as { runId?: string })?.runId ?? 'unknown',
      tasksTotal:     0,
      tasksCompleted: 0,
      tasksFailed:    0,
      durationMs:     0,
      error:          `Invalid input: ${validated.error}`,
    };
  }

  const input     = validated.data;
  const { runId } = input;
  const session   = createSession(runId, input.projectId, input.plan.tasks.length);
  const startedAt = new Date();

  executorLogger.info(runId, 'executeTask called', {
    sessionId: session.sessionId,
    planId:    input.plan.planId,
    taskCount: input.plan.tasks.length,
  });

  startSession(session.sessionId);

  try {
    const result = await runExecutorEngine(input);

    if (result.ok) completeSession(session.sessionId);
    else           failSession(session.sessionId);

    executorLogger.info(runId, `Task execution complete — ok=${result.ok}`, {
      tasksCompleted: result.tasksCompleted,
      tasksFailed:    result.tasksFailed,
      durationMs:     elapsedMs(startedAt),
    });

    removeSession(session.sessionId);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failSession(session.sessionId);
    executorLogger.error(runId, `Execution failed: ${error}`);
    removeSession(session.sessionId);

    return {
      ok:             false,
      runId,
      tasksTotal:     input.plan.tasks.length,
      tasksCompleted: 0,
      tasksFailed:    input.plan.tasks.length,
      durationMs:     elapsedMs(startedAt),
      error,
    };
  }
}

export function shutdownExecutor(): void {
  const active = listActiveSessions();
  if (active.length > 0) {
    console.warn(`[executor-agent] Shutting down with ${active.length} active session(s)`);
  }
  unregisterExecutorEventHandlers();
  _initialized = false;
  console.log('[executor-agent] Shutdown complete');
}

export type { ExecutorInput, ExecutorResult } from './types.ts';
