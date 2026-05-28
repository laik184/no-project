/**
 * server/orchestration/routing/workflow-routing.ts
 *
 * Routes workflow execution: selects execution strategy and ordering
 * based on workflow dependencies and orchestration options.
 * Pure routing logic — no dispatch, no tool execution.
 */

import type { Workflow, OrchestrationRequest } from '../types/orchestration.types.ts';
import { orderWorkflows } from '../planning/execution-plan-builder.ts';
import { shouldStopOnFailure } from '../coordination/orchestration-routing.ts';

// ── Execution strategy ────────────────────────────────────────────────────────

export type ExecutionStrategy = 'sequential' | 'parallel' | 'wave';

export interface WorkflowExecutionPlan {
  strategy:   ExecutionStrategy;
  waves:      Workflow[][];
  stopOnFail: boolean;
}

// ── Route builder ─────────────────────────────────────────────────────────────

export function buildWorkflowExecutionPlan(
  req:       OrchestrationRequest,
  workflows: Workflow[],
): WorkflowExecutionPlan {
  const stopOnFail = shouldStopOnFailure(req);

  if (workflows.length === 0) {
    return { strategy: 'sequential', waves: [], stopOnFail };
  }

  if (workflows.length === 1) {
    return { strategy: 'sequential', waves: [[workflows[0]]], stopOnFail };
  }

  const hasExplicitDeps = workflows.some(w => w.dependsOn && w.dependsOn.length > 0);

  if (hasExplicitDeps) {
    const ordered = orderWorkflows(workflows);
    const waves   = buildDependencyWaves(ordered);
    const strategy: ExecutionStrategy = waves.some(w => w.length > 1) ? 'wave' : 'sequential';
    return { strategy, waves, stopOnFail };
  }

  // No deps — all can run in parallel or sequential based on stopOnFail
  if (!stopOnFail) {
    return { strategy: 'parallel', waves: [workflows], stopOnFail };
  }

  return { strategy: 'sequential', waves: workflows.map(w => [w]), stopOnFail };
}

// ── Wave builder ──────────────────────────────────────────────────────────────
// Groups topologically ordered workflows into waves that can execute in parallel.

function buildDependencyWaves(ordered: Workflow[]): Workflow[][] {
  const waves: Workflow[][] = [];
  const placed = new Set<string>();

  for (const wf of ordered) {
    const deps = wf.dependsOn ?? [];
    const allDepsPlaced = deps.every(d => placed.has(d));

    if (allDepsPlaced && waves.length > 0) {
      const lastWave = waves[waves.length - 1];
      const lastWaveDeps = lastWave.flatMap(w => w.dependsOn ?? []);
      const sharesNoDep  = !deps.some(d => lastWaveDeps.includes(d));

      if (sharesNoDep) {
        lastWave.push(wf);
        placed.add(wf.workflowId);
        continue;
      }
    }

    waves.push([wf]);
    placed.add(wf.workflowId);
  }

  return waves;
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function findWorkflowById(
  workflows: Workflow[],
  id:        string,
): Workflow | undefined {
  return workflows.find(w => w.workflowId === id);
}

export function getWorkflowDependencies(
  workflow:  Workflow,
  allWorkflows: Workflow[],
): Workflow[] {
  return (workflow.dependsOn ?? [])
    .map(id => findWorkflowById(allWorkflows, id))
    .filter((w): w is Workflow => w !== undefined);
}
