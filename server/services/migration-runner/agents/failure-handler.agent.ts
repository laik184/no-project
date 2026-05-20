import { FailureReport } from '../types.js';

interface FailureInput {
  executionId: string;
  failedMigration: string;
  error: string;
}

export const failureHandlerAgent = (input: FailureInput): FailureReport => ({
  executionId: input.executionId,
  failedMigration: input.failedMigration,
  error: input.error,
  rollbackRequested: true,
  generatedAt: new Date().toISOString(),
});
