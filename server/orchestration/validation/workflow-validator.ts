/**
 * server/orchestration/validation/workflow-validator.ts
 *
 * Validates workflow structure, phase ordering, and execution plans.
 * Pure validation — no side effects, no tool execution.
 */

import type { Workflow, Phase, ExecutionPlan, ValidationResult } from '../types/orchestration.types.ts';

const VALID_AGENT_TYPES = new Set([
  'planner', 'executor', 'verifier', 'browser',
  'filesystem', 'terminal', 'supervisor', 'coderx',
]);

// ── Phase validation ──────────────────────────────────────────────────────────

export function validatePhase(phase: Phase, index: number): string[] {
  const errors: string[] = [];
  const pfx = `phases[${index}]`;

  if (!phase.phaseId || typeof phase.phaseId !== 'string') {
    errors.push(`${pfx}.phaseId is required`);
  }
  if (!phase.name || typeof phase.name !== 'string') {
    errors.push(`${pfx}.name is required`);
  }
  if (!VALID_AGENT_TYPES.has(phase.agentType)) {
    errors.push(`${pfx}.agentType "${phase.agentType}" is not a valid agent type`);
  }
  if (typeof phase.input !== 'object' || phase.input === null || Array.isArray(phase.input)) {
    errors.push(`${pfx}.input must be a plain object`);
  }
  if (phase.dependsOn) {
    if (!Array.isArray(phase.dependsOn)) {
      errors.push(`${pfx}.dependsOn must be an array`);
    } else if (phase.dependsOn.includes(phase.phaseId)) {
      errors.push(`${pfx} cannot depend on itself`);
    }
  }

  return errors;
}

// ── Workflow validation ───────────────────────────────────────────────────────

export function validateWorkflow(workflow: Workflow, index: number): ValidationResult {
  const errors: string[] = [];
  const pfx = `workflows[${index}]`;

  if (!workflow.workflowId || typeof workflow.workflowId !== 'string') {
    errors.push(`${pfx}.workflowId is required`);
  }
  if (!workflow.name || typeof workflow.name !== 'string') {
    errors.push(`${pfx}.name is required`);
  }
  if (!Array.isArray(workflow.phases)) {
    errors.push(`${pfx}.phases must be an array`);
  } else if (workflow.phases.length === 0) {
    errors.push(`${pfx}.phases must contain at least one phase`);
  } else {
    for (let i = 0; i < workflow.phases.length; i++) {
      errors.push(...validatePhase(workflow.phases[i], i));
    }
    errors.push(...validatePhaseOrder(workflow.phases, pfx));
  }

  return { valid: errors.length === 0, errors };
}

// ── Phase ordering ────────────────────────────────────────────────────────────

function validatePhaseOrder(phases: Phase[], prefix: string): string[] {
  const errors: string[] = [];
  const phaseIds = new Set(phases.map(p => p.phaseId));

  // Check for duplicate phase IDs
  if (phaseIds.size !== phases.length) {
    errors.push(`${prefix}: duplicate phaseId values found`);
  }

  // Check dependency references exist
  for (const phase of phases) {
    for (const dep of phase.dependsOn ?? []) {
      if (!phaseIds.has(dep)) {
        errors.push(`${prefix}: phase "${phase.phaseId}" depends on unknown phase "${dep}"`);
      }
    }
  }

  // Check for dependency cycles (simple DFS)
  const visited   = new Set<string>();
  const inStack   = new Set<string>();
  const adjMap    = new Map<string, string[]>(phases.map(p => [p.phaseId, p.dependsOn ?? []]));

  function hasCycle(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id))  return false;
    visited.add(id);
    inStack.add(id);
    for (const dep of adjMap.get(id) ?? []) {
      if (hasCycle(dep)) return true;
    }
    inStack.delete(id);
    return false;
  }

  for (const phase of phases) {
    if (hasCycle(phase.phaseId)) {
      errors.push(`${prefix}: circular dependency detected involving phase "${phase.phaseId}"`);
      break;
    }
  }

  return errors;
}

// ── Execution plan validation ─────────────────────────────────────────────────

export function validateExecutionPlan(plan: ExecutionPlan): ValidationResult {
  const errors: string[] = [];

  if (!plan.planId)    errors.push('plan.planId is required');
  if (!plan.requestId) errors.push('plan.requestId is required');

  if (!Array.isArray(plan.workflows)) {
    errors.push('plan.workflows must be an array');
  } else if (plan.workflows.length === 0) {
    errors.push('plan.workflows must contain at least one workflow');
  } else {
    const workflowIds = new Set<string>();
    for (let i = 0; i < plan.workflows.length; i++) {
      const wf = plan.workflows[i];
      if (workflowIds.has(wf.workflowId)) {
        errors.push(`Duplicate workflowId: "${wf.workflowId}"`);
      }
      workflowIds.add(wf.workflowId);

      const result = validateWorkflow(wf, i);
      errors.push(...result.errors);
    }
  }

  return { valid: errors.length === 0, errors };
}
