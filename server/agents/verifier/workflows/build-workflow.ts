/**
 * workflows/build-workflow.ts
 * Orchestrates the build verification workflow (typecheck + build + deps).
 * ALL execution goes through tool-coordinator → dispatcher-client.
 */

import type { WorkflowInput, WorkflowResult } from '../types/workflow.types.ts';
import { buildContext, resultError } from '../coordination/dispatcher-client.ts';
import {
  runBuild, runTypecheck, validateDependencies,
} from '../coordination/tool-coordinator.ts';
import { eventPublisher } from '../events/event-publisher.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export async function runBuildWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const start   = Date.now();
  const context = buildContext(input.runId, input.projectId, input.sandboxRoot, {
    workflow: 'build',
  });
  const errors:   string[] = [];
  const warnings: string[] = [];

  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'build', 'start');
  verifierLogger.workflow(input.runId, 'build', 'start');

  if (input.metadata?.checkDeps !== false) {
    const depsResult = await validateDependencies(context, { phase: 'dependencies' });
    if (!depsResult.ok) errors.push(resultError(depsResult));
  }

  const tcResult = await runTypecheck(context, { phase: 'typecheck', timeoutMs: 60_000 });
  if (!tcResult.ok) errors.push(`Typecheck: ${resultError(tcResult)}`);

  if (errors.length === 0) {
    const buildResult = await runBuild(context, { phase: 'build', timeoutMs: 120_000 });
    if (!buildResult.ok) errors.push(`Build: ${resultError(buildResult)}`);
  }

  const durationMs = Date.now() - start;
  const passed     = errors.length === 0;

  const event = passed ? 'end' : 'fail';
  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'build', event);
  verifierLogger.workflow(input.runId, 'build', event, { durationMs, errors: errors.slice(0, 3) });

  return {
    runId:      input.runId,
    kind:       'build',
    status:     passed ? 'completed' : 'failed',
    passed,
    errors,
    warnings,
    durationMs,
  };
}
