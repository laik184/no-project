/**
 * server/agents/terminal/execution/step-runner.ts
 *
 * Converts a single ExecutionStep into a dispatcher call.
 * Used by the execution loop to process one step at a time.
 */

import type { ExecutionStep, StepOutcome }  from '../types/terminal.types.ts';
import type { TerminalExecutionContext }     from '../core/terminal-context.ts';
import { routeStep }                         from '../coordination/execution-routing.ts';
import { coordinateCommand }                 from '../coordination/tool-coordinator.ts';
import { elapsedMs, toErrorMessage }         from '../utils/execution-utils.ts';
import { terminalLogger }                    from '../telemetry/terminal-logger.ts';

export async function runSingleStep(
  step: ExecutionStep,
  ctx:  TerminalExecutionContext,
): Promise<StepOutcome> {
  const start    = Date.now();
  const decision = routeStep(step);

  if (!decision) {
    terminalLogger.debug(ctx.runId, `No route for step type "${step.type}" — treating as pass-through`, { stepId: step.id });
    return {
      stepId:     step.id,
      success:    true,
      output:     `Unrouted step type "${step.type}" — skipped`,
      durationMs: elapsedMs(start),
      attempts:   1,
    };
  }

  terminalLogger.debug(ctx.runId, `Step ${step.id} → tool ${decision.toolName}`, { type: step.type });

  try {
    const response = await coordinateCommand(
      ctx.runId,
      ctx.projectId,
      ctx.sandboxRoot,
      decision,
    );

    return {
      stepId:     step.id,
      success:    response.ok,
      output:     response.ok ? String(response.data ?? '') : undefined,
      error:      response.ok ? undefined : response.error,
      durationMs: elapsedMs(start),
      attempts:   1,
    };
  } catch (err) {
    const error = toErrorMessage(err);
    terminalLogger.error(ctx.runId, `Step ${step.id} threw: ${error}`);
    return {
      stepId:     step.id,
      success:    false,
      error,
      durationMs: elapsedMs(start),
      attempts:   1,
    };
  }
}
