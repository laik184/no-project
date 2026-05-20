import { ExecutionPlan, MigrationScript } from '../types.js';
import { resolveExecutionOrder } from '../utils/order-resolver.util.js';

export const executionPlannerAgent = (executionId: string, scripts: MigrationScript[]): ExecutionPlan => ({
  executionId,
  migrations: resolveExecutionOrder(scripts),
});
