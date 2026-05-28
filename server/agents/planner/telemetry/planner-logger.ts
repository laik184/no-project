/**
 * server/agents/planner/telemetry/planner-logger.ts
 *
 * Structured logger for the planner agent.
 * Logs: planning lifecycle, retries, failures, refinement attempts.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  ts:    string;
  level: LogLevel;
  runId: string;
  msg:   string;
  meta?: Record<string, unknown>;
}

function emit(
  level: LogLevel,
  runId: string,
  msg:   string,
  meta?: Record<string, unknown>,
): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, runId, msg, meta };
  const prefix = `[planner-agent][${level.toUpperCase()}][${runId.slice(0, 8)}]`;
  const line   = `${prefix} ${msg}`;
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else console.log(line, meta ?? '');
  void entry;
}

export const plannerLogger = {
  info(runId: string, msg: string, meta?: Record<string, unknown>): void {
    emit('info', runId, msg, meta);
  },

  warn(runId: string, msg: string, meta?: Record<string, unknown>): void {
    emit('warn', runId, msg, meta);
  },

  error(runId: string, msg: string, meta?: Record<string, unknown>): void {
    emit('error', runId, msg, meta);
  },

  debug(runId: string, msg: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') emit('debug', runId, msg, meta);
  },

  phase(runId: string, phase: string, meta?: Record<string, unknown>): void {
    emit('info', runId, `phase → ${phase}`, meta);
  },

  task(runId: string, taskId: string, event: string, meta?: Record<string, unknown>): void {
    emit('info', runId, `task[${taskId}] → ${event}`, meta);
  },

  retry(runId: string, taskId: string, attempt: number, reason: string): void {
    emit('warn', runId, `retry task[${taskId}] attempt=${attempt} reason="${reason}"`);
  },

  refinement(runId: string, attempt: number, reason: string): void {
    emit('info', runId, `plan refinement attempt=${attempt} reason="${reason}"`);
  },

  planReady(runId: string, planId: string, phaseCount: number, taskCount: number): void {
    emit('info', runId, `execution plan ready planId=${planId}`, { phaseCount, taskCount });
  },

  sessionStart(runId: string, projectId: string, goal: string): void {
    emit('info', runId, 'planning session started', { projectId, goal });
  },

  sessionEnd(runId: string, success: boolean, durationMs: number): void {
    emit(
      success ? 'info' : 'error',
      runId,
      `planning session ended success=${success}`,
      { durationMs },
    );
  },
};
