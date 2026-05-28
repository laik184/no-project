/**
 * server/agents/coderx/coordination/coding-routing.ts
 *
 * @deprecated This module is no longer in the runtime execution path.
 *
 * The step-runner now calls dispatcher-client directly:
 *   step-runner → dispatcher-client → tool-dispatcher → tool
 *
 * This file is kept for reference only and will be removed in a future cleanup.
 * Do NOT add new callers. Do NOT use in any execution path.
 */

import type { CodingTask, CoderXExecutionContext } from '../types/coderx.types.ts';
import { coordinateCodingTask }                    from './tool-coordinator.ts';
import { executeTool }                             from './dispatcher-client.ts';
import { toToolContext }                           from '../core/coderx-context.ts';
import { assertRoutedCodingStep }                  from '../validation/coding-validator.ts';
import type { ToolExecutionResult }                from './dispatcher-client.ts';

/** @deprecated Use step-runner → dispatcher-client directly. */
export async function routeCodingTask(
  task:    CodingTask,
  context: CoderXExecutionContext,
): Promise<ToolExecutionResult<unknown>> {
  const routed = coordinateCodingTask(task);
  assertRoutedCodingStep(routed);

  const toolCtx = toToolContext(context);
  return executeTool(routed.toolName, routed.toolInput, toolCtx);
}
