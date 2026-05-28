/**
 * server/agents/terminal/telemetry/terminal-logger.ts
 *
 * Structured logger for the terminal agent lifecycle.
 * Logs execution events, retries, failures, and recovery attempts.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts:      string;
  level:   LogLevel;
  runId:   string;
  message: string;
  meta?:   Record<string, unknown>;
}

const LOG_BUFFER_SIZE = 200;
const buffer: LogEntry[] = [];

function emit(level: LogLevel, runId: string, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    ts:    new Date().toISOString(),
    level,
    runId,
    message,
    meta,
  };

  buffer.push(entry);
  if (buffer.length > LOG_BUFFER_SIZE) buffer.shift();

  const prefix = `[terminal-agent][${runId.slice(0, 8)}]`;
  if (level === 'error') {
    console.error(`${prefix} ${message}`, meta ?? '');
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, meta ?? '');
  } else {
    console.log(`${prefix} ${message}`, meta ?? '');
  }
}

export const terminalLogger = {
  debug(runId: string, message: string, meta?: Record<string, unknown>): void {
    emit('debug', runId, message, meta);
  },
  info(runId: string, message: string, meta?: Record<string, unknown>): void {
    emit('info', runId, message, meta);
  },
  warn(runId: string, message: string, meta?: Record<string, unknown>): void {
    emit('warn', runId, message, meta);
  },
  error(runId: string, message: string, meta?: Record<string, unknown>): void {
    emit('error', runId, message, meta);
  },
  recent(runId?: string, limit = 50): readonly LogEntry[] {
    const entries = runId ? buffer.filter((e) => e.runId === runId) : buffer;
    return Object.freeze(entries.slice(-limit));
  },
  clearRun(runId: string): void {
    const keep = buffer.filter((e) => e.runId !== runId);
    buffer.length = 0;
    buffer.push(...keep);
  },
};
