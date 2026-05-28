/**
 * server/orchestration/coordination/orchestration-routing.ts
 *
 * Determines which coordination path to take for each orchestration request.
 * Pure routing logic — no dispatch, no tool execution, no filesystem access.
 */

import type { OrchestrationRequest, Workflow, AgentType } from '../types/orchestration.types.ts';

// ── Route descriptors ─────────────────────────────────────────────────────────

export type OrchestrationRoute =
  | 'sequential'
  | 'parallel'
  | 'single_workflow';

export interface RoutingDecision {
  route:         OrchestrationRoute;
  workflowCount: number;
  agentsInvolved: AgentType[];
  reason:        string;
}

// ── Main routing function ─────────────────────────────────────────────────────

export function resolveOrchestrationRoute(
  req:       OrchestrationRequest,
  workflows: Workflow[],
): RoutingDecision {
  const workflowCount   = workflows.length;
  const agentsInvolved  = collectAgentTypes(workflows);

  if (workflowCount === 0) {
    return {
      route:          'single_workflow',
      workflowCount:  0,
      agentsInvolved: [],
      reason:         'No workflows to route — empty execution plan',
    };
  }

  if (workflowCount === 1) {
    return {
      route:          'single_workflow',
      workflowCount:  1,
      agentsInvolved,
      reason:         'Single workflow — direct execution path',
    };
  }

  // If any workflow has dependsOn, run sequentially
  const hasExplicitDeps = workflows.some(w => w.dependsOn && w.dependsOn.length > 0);
  if (hasExplicitDeps) {
    return {
      route:          'sequential',
      workflowCount,
      agentsInvolved,
      reason:         'Explicit workflow dependencies detected — sequential execution required',
    };
  }

  // If options explicitly request parallel
  if (req.options?.stopOnFailure === false) {
    return {
      route:          'parallel',
      workflowCount,
      agentsInvolved,
      reason:         'stopOnFailure=false with multiple independent workflows — parallel execution',
    };
  }

  return {
    route:          'sequential',
    workflowCount,
    agentsInvolved,
    reason:         'Default sequential execution for multiple workflows',
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectAgentTypes(workflows: Workflow[]): AgentType[] {
  const types = new Set<AgentType>();
  for (const wf of workflows) {
    for (const phase of wf.phases) {
      types.add(phase.agentType);
    }
  }
  return Array.from(types);
}

export function shouldStopOnFailure(req: OrchestrationRequest): boolean {
  return req.options?.stopOnFailure !== false;
}
