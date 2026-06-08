/**
 * server/orchestration/planning/workflow-planner.ts
 *
 * Builds workflow structure from an orchestration request.
 * Pure planning logic — no dispatch, no tool execution, no filesystem access.
 */

import type {
  OrchestrationRequest,
  Workflow,
  Phase,
  AgentType,
  WorkflowIntent,
} from '../types/orchestration.types.ts';
import { newWorkflowId } from '../utils/orchestration-utils.ts';
import { buildPhases }  from './phase-planner.ts';

// WorkflowIntent is defined in ../types/orchestration.types.ts to prevent the
// circular dependency: workflow-planner ↔ phase-planner.
// Re-export so existing consumers don't break.
export type { WorkflowIntent } from '../types/orchestration.types.ts';

function classifyIntent(goal: string): WorkflowIntent {
  const g = goal.toLowerCase();
  if (g.includes('fix') || g.includes('bug') || g.includes('error'))      return 'fix_bug';
  if (g.includes('refactor') || g.includes('clean') || g.includes('move')) return 'refactor';
  if (g.includes('component') || g.includes('ui') || g.includes('page'))   return 'generate_ui';
  if (g.includes('api') || g.includes('endpoint') || g.includes('route'))  return 'add_api';
  if (g.includes('test') || g.includes('verify') || g.includes('check'))   return 'verify_runtime';
  if (g.includes('build') || g.includes('create') || g.includes('implement')) return 'build_feature';
  return 'general';
}

// ── Primary agent selection ───────────────────────────────────────────────────

function primaryAgentForIntent(intent: WorkflowIntent): AgentType {
  const map: Record<WorkflowIntent, AgentType> = {
    build_feature:  'executor',
    fix_bug:        'executor',
    refactor:       'executor',
    generate_ui:    'executor',
    add_api:        'executor',
    verify_runtime: 'verifier',
    general:        'executor',
  };
  return map[intent];
}

// ── Workflow builder ──────────────────────────────────────────────────────────

export function planWorkflows(req: OrchestrationRequest): Workflow[] {
  const intent      = classifyIntent(req.goal);
  const primaryAgent = primaryAgentForIntent(intent);

  // Standard 3-phase workflow: plan → execute → verify
  const mainWorkflow: Workflow = {
    workflowId: newWorkflowId(),
    name:       `main:${intent}`,
    phases:     buildPhases(req, intent, primaryAgent),
    parallel:   false,
  };

  return [mainWorkflow];
}

// ── Workflow summary ──────────────────────────────────────────────────────────

export function describeWorkflow(workflow: Workflow): string {
  const agents = [...new Set(workflow.phases.map(p => p.agentType))].join(', ');
  return `Workflow[${workflow.workflowId}] "${workflow.name}" — ${workflow.phases.length} phases, agents: [${agents}]`;
}
