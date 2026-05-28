/**
 * orchestration/task-router.ts
 * Routes verification phases to the appropriate workflow.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';
import type { WorkflowInput, WorkflowKind, WorkflowResult } from '../types/workflow.types.ts';
import { workflowForPhase } from '../coordination/verification-routing.ts';
import { runBuildWorkflow }       from '../workflows/build-workflow.ts';
import { runRuntimeWorkflow }     from '../workflows/runtime-workflow.ts';
import { runValidationWorkflow }  from '../workflows/validation-workflow.ts';
import { runDiagnosticsWorkflow } from '../workflows/diagnostics-workflow.ts';
import { runRecoveryWorkflow }    from '../workflows/recovery-workflow.ts';
import { verifierLogger }         from '../telemetry/verifier-logger.ts';

type WorkflowRunner = (input: WorkflowInput) => Promise<WorkflowResult>;

const WORKFLOW_REGISTRY: Record<WorkflowKind, WorkflowRunner> = {
  build:       runBuildWorkflow,
  runtime:     runRuntimeWorkflow,
  validation:  runValidationWorkflow,
  diagnostics: runDiagnosticsWorkflow,
  recovery:    runRecoveryWorkflow,
};

export async function routePhaseToWorkflow(
  phase: VerificationPhase,
  input: WorkflowInput,
): Promise<WorkflowResult> {
  const kind   = workflowForPhase(phase);
  const runner = WORKFLOW_REGISTRY[kind];

  if (!runner) {
    verifierLogger.error(input.runId, `No workflow registered for kind: ${kind}`, { phase });
    return {
      runId:      input.runId,
      kind,
      status:     'failed',
      passed:     false,
      errors:     [`No workflow registered for kind: ${kind}`],
      warnings:   [],
      durationMs: 0,
    };
  }

  return runner({ ...input, kind });
}

export async function routeWorkflow(
  kind:  WorkflowKind,
  input: WorkflowInput,
): Promise<WorkflowResult> {
  const runner = WORKFLOW_REGISTRY[kind];
  if (!runner) throw new Error(`[task-router] Unknown workflow kind: ${kind}`);
  return runner({ ...input, kind });
}

export function availableWorkflows(): WorkflowKind[] {
  return Object.keys(WORKFLOW_REGISTRY) as WorkflowKind[];
}
