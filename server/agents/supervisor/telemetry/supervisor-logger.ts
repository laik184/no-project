/**
 * server/agents/supervisor/telemetry/supervisor-logger.ts
 *
 * Structured logger for the supervisor agent.
 * Logs orchestration lifecycle, retries, escalations, and failures.
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
  const prefix = `[supervisor-agent][${level.toUpperCase()}][${runId.slice(0, 8)}]`;
  const line   = `${prefix} ${msg}`;
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else console.log(line, meta ?? '');
  void entry;
}

export const supervisorLogger = {
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

  task(runId: string, taskId: string, phase: string, meta?: Record<string, unknown>): void {
    emit('info', runId, `task[${taskId}] → ${phase}`, meta);
  },

  retry(runId: string, taskId: string, attempt: number, reason: string): void {
    emit('warn', runId, `retry task[${taskId}] attempt=${attempt} reason="${reason}"`);
  },

  escalate(runId: string, taskId: string, reason: string): void {
    emit('warn', runId, `escalate task[${taskId}] reason="${reason}"`);
  },

  sessionStart(runId: string, projectId: string, goal: string, totalTasks: number): void {
    emit('info', runId, 'supervision session started', { projectId, goal, totalTasks });
  },

  sessionEnd(runId: string, success: boolean, durationMs: number): void {
    emit(
      success ? 'info' : 'error',
      runId,
      `supervision session ended success=${success}`,
      { durationMs },
    );
  },
};
