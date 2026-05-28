/**
 * server/agents/filesystem/telemetry/filesystem-logger.ts
 *
 * Structured logger for the filesystem agent.
 * Logs operation lifecycle, retries, failures, and recovery attempts.
 */

import type { FilesystemOperationKind } from '../types/filesystem.types.ts';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level:       LogLevel;
  runId:       string;
  message:     string;
  context?:    Record<string, unknown>;
  timestamp:   string;
}

function write(entry: LogEntry): void {
  const prefix = `[fs-agent:${entry.runId.slice(0, 8)}]`;
  const ctx    = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  const line   = `${prefix} ${entry.message}${ctx}`;
  if (entry.level === 'error') {
    console.error(line);
  } else if (entry.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function log(
  level:   LogLevel,
  runId:   string,
  message: string,
  context?: Record<string, unknown>,
): void {
  write({ level, runId, message, context, timestamp: new Date().toISOString() });
}

// ── Public logger API ─────────────────────────────────────────────────────────

export const filesystemLogger = {
  info(runId: string, message: string, context?: Record<string, unknown>): void {
    log('info', runId, message, context);
  },

  warn(runId: string, message: string, context?: Record<string, unknown>): void {
    log('warn', runId, message, context);
  },

  error(runId: string, message: string, context?: Record<string, unknown>): void {
    log('error', runId, message, context);
  },

  debug(runId: string, message: string, context?: Record<string, unknown>): void {
    log('debug', runId, message, context);
  },

  operationStarted(runId: string, operationId: string, kind: FilesystemOperationKind, path: string): void {
    log('info', runId, `Operation started [${kind}]`, { operationId, path });
  },

  operationCompleted(runId: string, operationId: string, kind: FilesystemOperationKind, durationMs: number): void {
    log('info', runId, `Operation completed [${kind}] in ${durationMs}ms`, { operationId });
  },

  operationFailed(runId: string, operationId: string, kind: FilesystemOperationKind, error: string, retryCount: number): void {
    log('error', runId, `Operation failed [${kind}]: ${error}`, { operationId, retryCount });
  },

  operationRetrying(runId: string, operationId: string, kind: FilesystemOperationKind, attempt: number, delayMs: number): void {
    log('warn', runId, `Retrying [${kind}] attempt ${attempt} in ${delayMs}ms`, { operationId });
  },

  recoveryAttempt(runId: string, operationId: string, reason: string): void {
    log('warn', runId, `Recovery triggered: ${reason}`, { operationId });
  },

  sessionStarted(runId: string, sessionId: string, total: number): void {
    log('info', runId, `Session started — ${total} operation(s) queued`, { sessionId });
  },

  sessionCompleted(runId: string, sessionId: string, done: number, failed: number, durationMs: number): void {
    log('info', runId, `Session complete — ${done} succeeded, ${failed} failed`, { sessionId, durationMs });
  },

  sessionFailed(runId: string, sessionId: string, error: string): void {
    log('error', runId, `Session failed: ${error}`, { sessionId });
  },
};
