/**
 * telemetry/verifier-logger.ts
 * Structured logger for the verifier orchestration agent.
 * Wraps the shared runLogger.
 */

import { runLogger } from '../../../orchestration/telemetry/run-logger.ts';

const PREFIX = '[verifier]';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(
  runId:   string,
  level:   LogLevel,
  message: string,
  meta?:   Record<string, unknown>,
): void {
  runLogger.log(runId, level, `${PREFIX} ${message}`, meta);
}

export const verifierLogger = {
  debug(runId: string, message: string, meta?: Record<string, unknown>): void {
    log(runId, 'debug', message, meta);
  },
  info(runId: string, message: string, meta?: Record<string, unknown>): void {
    log(runId, 'info', message, meta);
  },
  warn(runId: string, message: string, meta?: Record<string, unknown>): void {
    log(runId, 'warn', message, meta);
  },
  error(runId: string, message: string, meta?: Record<string, unknown>): void {
    log(runId, 'error', message, meta);
  },
  phase(
    runId:  string,
    phase:  string,
    event:  'start' | 'end' | 'fail' | 'skip',
    meta?:  Record<string, unknown>,
  ): void {
    const level: LogLevel = event === 'fail' ? 'error' : 'info';
    log(runId, level, `phase [${phase}] ${event}`, meta);
  },
  workflow(
    runId:    string,
    workflow: string,
    event:    'start' | 'end' | 'fail',
    meta?:    Record<string, unknown>,
  ): void {
    const level: LogLevel = event === 'fail' ? 'error' : 'info';
    log(runId, level, `workflow [${workflow}] ${event}`, meta);
  },
  step(
    runId:    string,
    toolName: string,
    event:    'dispatch' | 'complete' | 'fail' | 'retry',
    meta?:    Record<string, unknown>,
  ): void {
    const level: LogLevel = event === 'fail' ? 'error' : 'debug';
    log(runId, level, `step [${toolName}] ${event}`, meta);
  },
};
