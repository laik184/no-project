/**
 * server/agents/planner/planning/execution-plan-builder.ts
 *
 * Assembles the final ExecutionPlan from resolved tasks and phases.
 * Populates both the phase-structured view and the flat executor-facing tasks list.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type {
  ExecutionPlan,
  PlannedTask,
  PlanTask,
  ExecutionPhase,
  PlanValidationResults,
} from '../types/planner.types.ts';
import { makePlanId, estimateDurationMs } from '../utils/planning-utils.ts';
import type { GoalAnalysis } from '../../../engine/planning/index.ts';

export interface PlanBuildInput {
  runId:      string;
  projectId:  string;
  goal:       string;
  tasks:      PlannedTask[];
  phases:     ExecutionPhase[];
  meta:       Record<string, unknown>;
  analysis?:  GoalAnalysis;
  validation?: PlanValidationResults;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildExecutionPlan(input: PlanBuildInput): ExecutionPlan {
  const { runId, projectId, goal, tasks, phases, meta, analysis, validation } = input;

  const totalTasks  = tasks.length;
  const estimatedMs = estimateDurationMs(phases.length, totalTasks);

  const flatTasks: PlanTask[]     = tasks.map(toExecutorTask);
  const frozenPhases: ExecutionPhase[] = phases.map(clonePhase);

  const appType    = deriveAppType(analysis);
  const complexity = deriveComplexity(totalTasks, phases.length);

  const validationResults: PlanValidationResults = validation ?? {
    valid:    true,
    errors:   [],
    warnings: [],
  };

  const plan: ExecutionPlan = {
    planId:            makePlanId(),
    runId,
    projectId,
    goal,
    phases:            frozenPhases,
    tasks:             flatTasks,
    totalTasks,
    estimatedMs,
    createdAt:         Date.now(),
    meta:              { ...meta },
    appType,
    complexity,
    validationResults,
  };

  return plan;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Map a PlannedTask to the executor-facing PlanTask shape.
 * Derives `title` from label and `category` from the task type prefix.
 */
function toExecutorTask(task: PlannedTask): PlanTask {
  const colonIdx = task.label.indexOf(': ');
  const category = colonIdx >= 0 ? task.label.slice(0, colonIdx) : 'generic';
  const title    = colonIdx >= 0 ? task.label.slice(colonIdx + 2) : task.label;

  return {
    id:           task.id,
    title,
    description:  task.description,
    category,
    priority:     task.priority,
    dependencies: [...task.dependencies],
    toolName:     task.toolName,
    input:        { ...task.input },
    timeoutMs:    task.timeoutMs,
    retryLimit:   task.retryLimit,
    estimatedMs:  task.estimatedMs,
    phaseIndex:   task.phase,
  };
}

function clonePhase(phase: ExecutionPhase): ExecutionPhase {
  return {
    index:       phase.index,
    label:       phase.label,
    strategy:    phase.strategy,
    canParallel: phase.canParallel,
    tasks:       phase.tasks.map(clonePlannedTask),
  };
}

function clonePlannedTask(task: PlannedTask): PlannedTask {
  return {
    id:           task.id,
    label:        task.label,
    description:  task.description,
    phase:        task.phase,
    priority:     task.priority,
    dependencies: [...task.dependencies],
    toolName:     task.toolName,
    input:        { ...task.input },
    timeoutMs:    task.timeoutMs,
    retryLimit:   task.retryLimit,
    estimatedMs:  task.estimatedMs,
  };
}

function deriveAppType(analysis?: GoalAnalysis): string {
  if (!analysis) return 'web';
  const types = new Set(analysis.components.map((c) => c.type));
  if (types.has('frontend') && types.has('backend')) return 'fullstack';
  if (types.has('api') && !types.has('frontend'))    return 'api';
  if (types.has('frontend'))                         return 'web';
  if (types.has('database'))                         return 'data';
  return 'generic';
}

function deriveComplexity(taskCount: number, phaseCount: number): string {
  const score = taskCount + phaseCount * 2;
  if (score <= 4)  return 'simple';
  if (score <= 10) return 'moderate';
  return 'complex';
}
