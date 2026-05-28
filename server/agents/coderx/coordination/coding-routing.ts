/**
 * server/agents/coderx/coordination/coding-routing.ts
 *
 * Routes coding steps through the tool-coordinator then dispatches
 * through dispatcher-client. Pure control-flow — no business logic.
 */

import type { CodingTask, CoderXExecutionContext } from '../types/coderx.types.ts';
import { coordinateCodingTask }                    from './tool-coordinator.ts';
import { execute }                                 from './dispatcher-client.ts';
import { toToolContext }                           from '../core/coderx-context.ts';
import { assertRoutedCodingStep }                  from '../validation/coding-validator.ts';
import type { ToolExecutionResult }                from './dispatcher-client.ts';

/**
 * Route a coding task through coordination → validation → dispatcher.
 * Returns the raw ToolExecutionResult — callers decide how to interpret it.
 */
export async function routeCodingTask(
  task:    CodingTask,
  context: CoderXExecutionContext,
): Promise<ToolExecutionResult<unknown>> {
  const routed = coordinateCodingTask(task);
  assertRoutedCodingStep(routed);

  const toolCtx = toToolContext(context);
  return execute(routed.toolName, routed.toolInput, toolCtx);
}
