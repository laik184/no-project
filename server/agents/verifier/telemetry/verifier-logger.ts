import { runLogger } from '../../../orchestration/telemetry/run-logger.ts';

const PREFIX = '[verifier]';

export const verifierLogger = {
  info(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'info', `${PREFIX} ${message}`, meta);
  },

  warn(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'warn', `${PREFIX} ${message}`, meta);
  },

  error(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'error', `${PREFIX} ${message}`, meta);
  },

  debug(runId: string, message: string, meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'debug', `${PREFIX} ${message}`, meta);
  },

  phase(runId: string, phase: string, event: 'start' | 'end' | 'fail', meta?: Record<string, unknown>): void {
    runLogger.log(runId, 'info', `${PREFIX} [${phase}] ${event}`, meta);
  },
};
