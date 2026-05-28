/**
 * server/agents/terminal/telemetry/terminal-logger.ts
 *
 * Structured logger for the terminal agent.
 * Logs execution lifecycle, retries, failures, and recovery.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  ts:        string;
  level:     LogLevel;
  runId:     string;
  msg:       string;
  meta?:     Record<string, unknown>;
}

function emit(level: LogLevel, runId: string, msg: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, runId, msg, meta };
  const line = `[terminal-agent][${level.toUpperCase()}][${runId.slice(0, 8)}] ${msg}`;
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else console.log(line, meta ?? '');
  void entry;
}

export const terminalLogger = {
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

  step(runId: string, stepId: string, phase: string, meta?: Record<string, unknown>): void {
    emit('info', runId, `step[${stepId}] → ${phase}`, meta);
  },

  retry(runId: string, stepId: string, attempt: number, reason: string): void {
    emit('warn', runId, `retry step[${stepId}] attempt=${attempt} reason="${reason}"`);
  },

  sessionStart(runId: string, projectId: string, totalSteps: number): void {
    emit('info', runId, `session started`, { projectId, totalSteps });
  },

  sessionEnd(runId: string, success: boolean, durationMs: number): void {
    emit(success ? 'info' : 'error', runId, `session ended success=${success}`, { durationMs });
  },
};
