import { runLogger } from '../../../orchestration/telemetry/run-logger.ts';

const PREFIX = '[executor]';

export const executorLogger = {
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

  getLogs(runId: string) {
    return runLogger
      .getLogs(runId)
      .filter((e) => (e as { message: string }).message.includes(PREFIX));
  },
};
