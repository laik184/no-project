import { DbAdapter, ExecutionPlan, RunnerOutput } from '../types.js';
import { normalizeError } from '../utils/error-normalizer.util.js';
import { executeSqlScript } from '../utils/sql-executor.util.js';

export const migrationRunnerAgent = async (dbAdapter: DbAdapter, plan: ExecutionPlan): Promise<RunnerOutput> => {
  const executed: string[] = [];
  const failed: string[] = [];

  for (const migration of plan.migrations) {
    try {
      await executeSqlScript(dbAdapter, migration);
      executed.push(migration.name);
    } catch (error) {
      failed.push(migration.name);
      return {
        executed,
        failed,
        error: normalizeError(error),
      };
    }
  }

  return {
    executed,
    failed,
  };
};
