/**
 * server/agents/coderx/telemetry/coderx-logger.ts
 *
 * Structured logging for the CoderX agent lifecycle.
 * Logs coding lifecycle events, retries, failures, and reasoning decisions.
 */

import type { DecisionOutcome } from '../types/coderx.types.ts';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  ts:       string;
  level:    LogLevel;
  tag:      string;
  message:  string;
  data?:    Record<string, unknown>;
}

function emit(level: LogLevel, tag: string, message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, tag, message, data };
  const line = `[coderx][${entry.level.toUpperCase()}] ${entry.tag} — ${entry.message}`;
  if (level === 'error') {
    console.error(line, data ?? '');
  } else if (level === 'warn') {
    console.warn(line, data ?? '');
  } else {
    console.log(line, data ?? '');
  }
}

export const coderxLogger = {

  agentStarted(runId: string, requestId: string): void {
    emit('info', 'lifecycle', 'CoderX agent started.', { runId, requestId });
  },

  agentCompleted(runId: string, durationMs: number, tasksCompleted: number): void {
    emit('info', 'lifecycle', 'CoderX agent completed.', { runId, durationMs, tasksCompleted });
  },

  agentFailed(runId: string, error: string): void {
    emit('error', 'lifecycle', 'CoderX agent failed.', { runId, error });
  },

  planBuilt(runId: string, planId: string, stepCount: number): void {
    emit('info', 'planning', 'Execution plan built.', { runId, planId, stepCount });
  },

  stepStarted(runId: string, stepId: string, toolName: string): void {
    emit('debug', 'execution', `Step started: ${toolName}`, { runId, stepId, toolName });
  },

  stepCompleted(runId: string, stepId: string, durationMs: number): void {
    emit('debug', 'execution', 'Step completed.', { runId, stepId, durationMs });
  },

  stepFailed(runId: string, stepId: string, error: string, retryCount: number): void {
    emit('warn', 'execution', 'Step failed.', { runId, stepId, error, retryCount });
  },

  stepRetrying(runId: string, stepId: string, attempt: number, delayMs: number): void {
    emit('info', 'retry', `Retrying step (attempt ${attempt}).`, { runId, stepId, attempt, delayMs });
  },

  decision(runId: string, stepId: string, outcome: DecisionOutcome, reason: string): void {
    emit('debug', 'decision', `Decision: ${outcome}`, { runId, stepId, outcome, reason });
  },

  stuck(runId: string, stepId: string): void {
    emit('warn', 'monitor', 'Stuck step detected.', { runId, stepId });
  },

  repeatedFailure(runId: string, toolName: string, count: number): void {
    emit('warn', 'monitor', `Repeated failure on tool: ${toolName}`, { runId, toolName, count });
  },
};
