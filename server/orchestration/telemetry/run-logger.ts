type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  runId: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: Date;
}

const MAX_ENTRIES_PER_RUN = 1000;
const store = new Map<string, LogEntry[]>();

function getOrCreate(runId: string): LogEntry[] {
  if (!store.has(runId)) store.set(runId, []);
  return store.get(runId)!;
}

function formatLine(entry: LogEntry): string {
  const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
  return `[${entry.timestamp.toISOString()}][${entry.level.toUpperCase()}][${entry.runId}] ${entry.message}${meta}`;
}

export const runLogger = {
  log(runId: string, level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = { runId, level, message, meta, timestamp: new Date() };
    const entries = getOrCreate(runId);

    if (entries.length >= MAX_ENTRIES_PER_RUN) entries.shift();
    entries.push(entry);

    const line = formatLine(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  },

  getLogs(runId: string, level?: LogLevel): LogEntry[] {
    const entries = store.get(runId) ?? [];
    return level ? entries.filter((e) => e.level === level) : [...entries];
  },

  getRecentLogs(runId: string, count: number): LogEntry[] {
    const entries = store.get(runId) ?? [];
    return entries.slice(-count);
  },

  clearLogs(runId: string): void {
    store.delete(runId);
  },

  getRunIds(): string[] {
    return Array.from(store.keys());
  },

  exportLogs(runId: string): string {
    return (store.get(runId) ?? []).map(formatLine).join('\n');
  },
};
