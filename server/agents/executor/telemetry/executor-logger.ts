/**
 * server/agents/executor/telemetry/executor-logger.ts
 *
 * Structured logger for the executor agent.
 * Logs execution lifecycle, retries, failures, and recovery attempts.
 */

import type { TaskKind } from '../types/executor.types.ts';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function write(
  level:   LogLevel,
  runId:   string,
  message: string,
  ctx?:    Record<string, unknown>,
): void {
  const prefix = `[executor:${runId.slice(0, 8)}]`;
  const suffix = ctx ? ` ${JSON.stringify(ctx)}` : '';
  const line   = `${prefix} ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const executorLogger = {
  info(runId: string, message: string, ctx?: Record<string, unknown>): void {
    write('info', runId, message, ctx);
  },

  warn(runId: string, message: string, ctx?: Record<string, unknown>): void {
    write('warn', runId, message, ctx);
  },

  error(runId: string, message: string, ctx?: Record<string, unknown>): void {
    write('error', runId, message, ctx);
  },

  debug(runId: string, message: string, ctx?: Record<string, unknown>): void {
    write('debug', runId, message, ctx);
  },

  taskStarted(runId: string, taskId: string, kind: TaskKind, stepId: string): void {
    write('info', runId, `Task started [${kind}]`, { taskId, stepId });
  },

  taskCompleted(runId: string, taskId: string, kind: TaskKind, durationMs: number): void {
    write('info', runId, `Task completed [${kind}] in ${durationMs}ms`, { taskId });
  },

  taskFailed(runId: string, taskId: string, kind: TaskKind, error: string, retries: number): void {
    write('error', runId, `Task failed [${kind}]: ${error}`, { taskId, retries });
  },

  taskRetrying(runId: string, taskId: string, kind: TaskKind, attempt: number, delayMs: number): void {
    write('warn', runId, `Retrying [${kind}] attempt ${attempt} in ${delayMs}ms`, { taskId });
  },

  sessionStarted(runId: string, sessionId: string, total: number): void {
    write('info', runId, `Session started — ${total} task(s) queued`, { sessionId });
  },

  sessionCompleted(runId: string, sessionId: string, done: number, failed: number, durationMs: number): void {
    write('info', runId, `Session complete — ${done} ok, ${failed} failed`, { sessionId, durationMs });
  },

  sessionFailed(runId: string, sessionId: string, error: string): void {
    write('error', runId, `Session failed: ${error}`, { sessionId });
  },

  planBuilt(runId: string, planId: string, steps: number): void {
    write('info', runId, `Execution plan built — ${steps} step(s)`, { planId });
  },

  recoveryAttempt(runId: string, stepId: string, reason: string): void {
    write('warn', runId, `Recovery triggered: ${reason}`, { stepId });
  },
};
