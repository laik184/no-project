import type { MigrationLog } from '../types.js';

interface LogRequest {
  executionId: string;
  level: MigrationLog['level'];
  step: string;
  message: string;
  migration?: string;
}

export const executionLoggerAgent = (logs: MigrationLog[], request: LogRequest): MigrationLog[] => [
  ...logs,
  {
    timestamp: new Date().toISOString(),
    executionId: request.executionId,
    level: request.level,
    step: request.step,
    message: request.message,
    migration: request.migration,
  },
];
