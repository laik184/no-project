type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  runId:     string;
  level:     LogLevel;
  message:   string;
  meta?:     Record<string, unknown>;
  timestamp: Date;
}

const MAX_PER_RUN = 1000;
const store       = new Map<string, LogEntry[]>();

function getOrCreate(runId: string): LogEntry[] {
  if (!store.has(runId)) store.set(runId, []);
  return store.get(runId)!;
}

function format(e: LogEntry): string {
  const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : '';
  return `[terminal][${e.timestamp.toISOString()}][${e.level.toUpperCase()}][${e.runId}] ${e.message}${meta}`;
}

export const runtimeLogger = {
  debug: (runId: string, msg: string, meta?: Record<string, unknown>) =>
    runtimeLogger.log(runId, 'debug', msg, meta),

  info: (runId: string, msg: string, meta?: Record<string, unknown>) =>
    runtimeLogger.log(runId, 'info', msg, meta),

  warn: (runId: string, msg: string, meta?: Record<string, unknown>) =>
    runtimeLogger.log(runId, 'warn', msg, meta),

  error: (runId: string, msg: string, meta?: Record<string, unknown>) =>
    runtimeLogger.log(runId, 'error', msg, meta),

  log(runId: string, level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = { runId, level, message, meta, timestamp: new Date() };
    const entries = getOrCreate(runId);
    if (entries.length >= MAX_PER_RUN) entries.shift();
    entries.push(entry);
    const line = format(entry);
    level === 'error' ? console.error(line)
      : level === 'warn' ? console.warn(line)
      : console.log(line);
  },

  getLogs: (runId: string): LogEntry[] => store.get(runId) ?? [],
  clear:   (runId: string): void       => { store.delete(runId); },
};
