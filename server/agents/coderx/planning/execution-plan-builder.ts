/**
 * server/agents/coderx/planning/execution-plan-builder.ts
 *
 * Converts an ImplementationPlan into a flat ordered list of CodingSteps
 * ready for dispatch. Resolves dependencies and respects phase parallelism.
 * Pure planning logic — no execution.
 */

import type {
  CodingPlan,
  CodingStep,
  ImplementationPlan,
  ImplementationPhase,
  CodingTask,
} from '../types/coderx.types.ts';
import { coordinateCodingTask }   from '../coordination/tool-coordinator.ts';
import { generateStepId }         from '../utils/coding-utils.ts';

export interface BuiltCodingPlan {
  readonly planId:      string;
  readonly requestId:   string;
  readonly steps:       CodingStep[];
  readonly totalSteps:  number;
  readonly phaseCount:  number;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildExecutionPlan(
  codingPlan:         CodingPlan,
  implementationPlan: ImplementationPlan,
): BuiltCodingPlan {
  const steps = flattenPhasesToSteps(implementationPlan.phases);

  return {
    planId:     implementationPlan.planId,
    requestId:  codingPlan.requestId,
    steps,
    totalSteps: steps.length,
    phaseCount: implementationPlan.phases.length,
  };
}

// ── Phase flattening ──────────────────────────────────────────────────────────

function flattenPhasesToSteps(phases: ImplementationPhase[]): CodingStep[] {
  const steps: CodingStep[] = [];
  for (const phase of phases) {
    for (const task of phase.tasks) {
      steps.push(buildStepFromTask(task));
    }
  }
  return steps;
}

function buildStepFromTask(task: CodingTask): CodingStep {
  const routed = coordinateCodingTask(task);
  return {
    stepId:    generateStepId(),
    taskId:    task.taskId,
    toolName:  routed.toolName,
    toolInput: routed.toolInput,
  };
}
