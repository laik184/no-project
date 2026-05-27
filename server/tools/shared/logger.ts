/**
 * server/tools/shared/logger.ts
 *
 * Minimal structured logger for the tools layer.
 * Emits JSON lines to stdout — compatible with the existing EventBus pattern.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ToolLogEntry {
  ts:        string;
  level:     LogLevel;
  layer:     'tools';
  tool?:     string;
  runId?:    string;
  message:   string;
  data?:     unknown;
}

function emit(level: LogLevel, message: string, context: {
  tool?:  string;
  runId?: string;
  data?:  unknown;
} = {}): void {
  const entry: ToolLogEntry = {
    ts:      new Date().toISOString(),
    level,
    layer:   'tools',
    message,
    ...context,
  };
  const out = level === 'error' ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + '\n');
}

export const toolsLogger = {
  debug: (message: string, ctx?: { tool?: string; runId?: string; data?: unknown }) =>
    emit('debug', message, ctx),
  info:  (message: string, ctx?: { tool?: string; runId?: string; data?: unknown }) =>
    emit('info',  message, ctx),
  warn:  (message: string, ctx?: { tool?: string; runId?: string; data?: unknown }) =>
    emit('warn',  message, ctx),
  error: (message: string, ctx?: { tool?: string; runId?: string; data?: unknown }) =>
    emit('error', message, ctx),
};
