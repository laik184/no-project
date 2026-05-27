import { runLogger } from '../../../orchestration/telemetry/run-logger.ts';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  runId: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: Date;
}

const _buffer = new Map<string, LogEntry[]>();
const MAX_BUFFER = 200;

function buffer(runId: string, level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!_buffer.has(runId)) _buffer.set(runId, []);
  const entries = _buffer.get(runId)!;
  entries.push({ runId, level, message, meta, timestamp: new Date() });
  if (entries.length > MAX_BUFFER) entries.shift();
}

export const supervisorLogger = {
  info(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'info', message, meta);
    buffer(runId, 'info', message, meta);
  },

  warn(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'warn', message, meta);
    buffer(runId, 'warn', message, meta);
  },

  error(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'error', message, meta);
    buffer(runId, 'error', message, meta);
  },

  debug(runId: string, message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      runLogger.log(runId, 'info', `[debug] ${message}`, meta);
    }
    buffer(runId, 'debug', message, meta);
  },

  getLogs(runId: string, level?: LogLevel): LogEntry[] {
    const entries = _buffer.get(runId) ?? [];
    return level ? entries.filter((e) => e.level === level) : [...entries];
  },

  clearRun(runId: string): void {
    _buffer.delete(runId);
  },

  getRunIds(): string[] {
    return Array.from(_buffer.keys());
  },
};
