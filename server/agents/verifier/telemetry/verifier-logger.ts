/**
 * server/agents/verifier/telemetry/verifier-logger.ts
 * Structured logging for the verifier agent orchestration layer.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, runId: string, msg: string, meta?: Record<string, unknown>): void {
  const prefix = `[verifier-agent:${runId.slice(-8)}]`;
  const line   = meta ? `${prefix} ${msg} ${JSON.stringify(meta)}` : `${prefix} ${msg}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const verifierLogger = {
  info(runId: string, msg: string, meta?: Record<string, unknown>): void {
    log('info', runId, msg, meta);
  },

  warn(runId: string, msg: string, meta?: Record<string, unknown>): void {
    log('warn', runId, msg, meta);
  },

  error(runId: string, msg: string, meta?: Record<string, unknown>): void {
    log('error', runId, msg, meta);
  },

  phase(runId: string, phase: VerificationPhase, status: 'start' | 'pass' | 'fail' | 'skip', meta?: Record<string, unknown>): void {
    log('info', runId, `Phase ${phase} → ${status}`, meta);
  },

  step(runId: string, stepId: string, status: 'start' | 'complete' | 'fail' | 'retry', meta?: Record<string, unknown>): void {
    log('info', runId, `Step [${stepId}] → ${status}`, meta);
  },

  retry(runId: string, stepId: string, attempt: number, error: string): void {
    log('warn', runId, `Retry step [${stepId}] attempt=${attempt}`, { error });
  },

  lifecycle(runId: string, event: string, meta?: Record<string, unknown>): void {
    log('info', runId, `Lifecycle: ${event}`, meta);
  },
};
