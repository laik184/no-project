/**
 * server/orchestration/planning/execution-plan-builder.ts
 *
 * Builds the final execution graph/order from an orchestration request.
 * Composes workflows and validates the resulting plan.
 * Pure planning — no dispatch, no tool execution, no filesystem access.
 */

import type { OrchestrationRequest, ExecutionPlan, Workflow } from '../types/orchestration.types.ts';
import { planWorkflows }          from './workflow-planner.ts';
import { validateExecutionPlan }  from '../validation/workflow-validator.ts';
import { newPlanId, now }         from '../utils/orchestration-utils.ts';

// ── Builder ───────────────────────────────────────────────────────────────────

export interface BuildPlanResult {
  ok:       boolean;
  plan?:    ExecutionPlan;
  errors?:  string[];
}

export function buildExecutionPlan(req: OrchestrationRequest): BuildPlanResult {
  let workflows: Workflow[];

  try {
    workflows = planWorkflows(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [`Workflow planning failed: ${msg}`] };
  }

  const plan: ExecutionPlan = {
    planId:    newPlanId(),
    requestId: req.orchestrationId,
    workflows,
    createdAt: now(),
  };

  const validation = validateExecutionPlan(plan);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, plan };
}

// ── Dependency ordering ───────────────────────────────────────────────────────
// Returns workflows in topological execution order respecting dependsOn edges.

export function orderWorkflows(workflows: Workflow[]): Workflow[] {
  const idMap    = new Map<string, Workflow>(workflows.map(w => [w.workflowId, w]));
  const visited  = new Set<string>();
  const ordered: Workflow[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const wf = idMap.get(id);
    if (!wf) return;
    for (const dep of wf.dependsOn ?? []) {
      visit(dep);
    }
    ordered.push(wf);
  }

  for (const wf of workflows) {
    visit(wf.workflowId);
  }

  return ordered;
}

// ── Plan summary ──────────────────────────────────────────────────────────────

export function summarizePlan(plan: ExecutionPlan): {
  planId:         string;
  workflowCount:  number;
  phaseCount:     number;
  agentTypes:     string[];
} {
  const agentTypes = new Set<string>();
  let phaseCount   = 0;

  for (const wf of plan.workflows) {
    for (const phase of wf.phases) {
      agentTypes.add(phase.agentType);
      phaseCount++;
    }
  }

  return {
    planId:        plan.planId,
    workflowCount: plan.workflows.length,
    phaseCount,
    agentTypes:    Array.from(agentTypes),
  };
}
