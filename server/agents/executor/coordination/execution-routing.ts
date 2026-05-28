/**
 * server/agents/executor/coordination/execution-routing.ts
 *
 * Routes execution tasks to the correct operation via tool-coordinator,
 * then dispatches through dispatcher-client.
 * Pure control-flow — no business logic, no direct execution.
 */

import type { ExecutionTask, ExecutorExecutionContext } from '../types/executor.types.ts';
import { coordinateTask }     from './tool-coordinator.ts';
import { assertRoutedStep }   from '../validation/tool-validator.ts';
import { execute }            from './dispatcher-client.ts';
import { toToolContext }      from '../core/executor-context.ts';
import type { ToolExecutionResult } from './dispatcher-client.ts';

/**
 * Route a task through coordination → validation → dispatcher.
 * Returns the raw ToolExecutionResult — callers decide how to interpret it.
 */
export async function routeTask(
  task:    ExecutionTask,
  context: ExecutorExecutionContext,
): Promise<ToolExecutionResult<unknown>> {
  const routed = coordinateTask(task, context.sandboxRoot);
  assertRoutedStep(routed);

  const toolCtx = toToolContext(context);
  return execute(routed.toolName, routed.toolInput, toolCtx);
}
