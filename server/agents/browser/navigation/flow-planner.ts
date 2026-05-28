/**
 * server/agents/browser/navigation/flow-planner.ts
 *
 * Creates a structured browser execution flow from multi-step goals.
 * Pure planning — no tool calls, no side effects.
 */

import type { FlowStep } from '../types/navigation.types.ts';
import { generateFlowId } from '../utils/browser-utils.ts';

export interface ExecutionFlow {
  flowId:    string;
  name:      string;
  steps:     FlowStep[];
  timeoutMs: number;
  priority:  number;
}

export interface FlowPlan {
  runId:    string;
  flows:    ExecutionFlow[];
  parallel: boolean;
  totalSteps: number;
}

export interface RawFlow {
  name:       string;
  steps:      FlowStep[];
  timeoutMs?: number;
  priority?:  number;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateStep(step: FlowStep): string | null {
  if (!step.action?.trim()) return 'Step action is required';
  const actionsThatNeedSelector = ['click', 'fill', 'select', 'wait', 'screenshot-element'];
  if (actionsThatNeedSelector.includes(step.action) && !step.selector) {
    return `Step action "${step.action}" requires a selector`;
  }
  if (step.action === 'fill' && step.value === undefined) {
    return 'Fill step requires a value';
  }
  return null;
}

function validateFlow(raw: RawFlow): string[] {
  const errors: string[] = [];
  if (!raw.name?.trim()) errors.push('Flow name is required');
  if (!raw.steps?.length) errors.push('Flow must have at least one step');
  for (const step of (raw.steps ?? [])) {
    const err = validateStep(step);
    if (err) errors.push(err);
  }
  return errors;
}

// ── Planner ───────────────────────────────────────────────────────────────────

export function planFlows(
  runId:   string,
  rawFlows: RawFlow[],
  opts:    { parallel?: boolean; defaultTimeout?: number } = {},
): FlowPlan {
  const flows: ExecutionFlow[] = rawFlows.map((raw, i) => ({
    flowId:    generateFlowId(),
    name:      raw.name ?? `flow_${i}`,
    steps:     raw.steps ?? [],
    timeoutMs: raw.timeoutMs ?? opts.defaultTimeout ?? 30_000,
    priority:  raw.priority ?? i,
  }));

  const sorted = [...flows].sort((a, b) => a.priority - b.priority);
  const totalSteps = sorted.reduce((acc, f) => acc + f.steps.length, 0);

  return {
    runId,
    flows:    sorted,
    parallel: opts.parallel ?? false,
    totalSteps,
  };
}

export function validateFlowInputs(rawFlows: RawFlow[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const flow of rawFlows) {
    errors.push(...validateFlow(flow));
  }
  return { valid: errors.length === 0, errors };
}

export function flowFromGoal(steps: FlowStep[], name = 'default'): RawFlow {
  return { name, steps, timeoutMs: 30_000 };
}
