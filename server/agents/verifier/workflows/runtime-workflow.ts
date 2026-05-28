/**
 * workflows/runtime-workflow.ts
 * Orchestrates the runtime verification workflow (health + endpoints).
 */

import type { WorkflowInput, WorkflowResult } from '../types/workflow.types.ts';
import { buildContext, resultError } from '../coordination/dispatcher-client.ts';
import { checkServerHealth, validateEndpoint } from '../coordination/tool-coordinator.ts';
import { eventPublisher } from '../events/event-publisher.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import type { EndpointSpec } from '../types/verifier.types.ts';

const DEFAULT_PORT = 3001;

export async function runRuntimeWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const start   = Date.now();
  const port    = input.port ?? DEFAULT_PORT;
  const context = buildContext(input.runId, input.projectId, input.sandboxRoot, { workflow: 'runtime', port });
  const errors:   string[] = [];
  const warnings: string[] = [];

  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'runtime', 'start');

  const healthResult = await checkServerHealth(context, port, { phase: 'runtime', timeoutMs: 30_000 });
  if (!healthResult.ok) {
    errors.push(`Server health check failed: ${resultError(healthResult)}`);
    const durationMs = Date.now() - start;
    eventPublisher.workflowLifecycle(input.runId, input.projectId, 'runtime', 'fail');
    return { runId: input.runId, kind: 'runtime', status: 'failed', passed: false, errors, warnings, durationMs };
  }

  for (const ep of (input.endpoints ?? []) as EndpointSpec[]) {
    const epResult = await validateEndpoint(context, ep.path, ep.method, ep.expectedStatus, port, { phase: 'endpoints' });
    if (!epResult.ok) errors.push(`Endpoint ${ep.method} ${ep.path}: ${resultError(epResult)}`);
  }

  const durationMs = Date.now() - start;
  const passed     = errors.length === 0;
  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'runtime', passed ? 'end' : 'fail');
  verifierLogger.workflow(input.runId, 'runtime', passed ? 'end' : 'fail', { durationMs });

  return { runId: input.runId, kind: 'runtime', status: passed ? 'completed' : 'failed', passed, errors, warnings, durationMs };
}
