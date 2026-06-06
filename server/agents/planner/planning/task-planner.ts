/**
 * server/agents/planner/planning/task-planner.ts
 *
 * Converts a user goal into a flat list of PlannedTasks.
 * Orchestration only — delegates analysis to the planning engine.
 * No direct execution, no tool calls, no spawn/exec.
 */

import type { PlannedTask } from '../types/planner.types.ts';
import { makeTaskId, normaliseGoal } from '../utils/planning-utils.ts';
import {
  analyzeGoal,
  detectDependencies,
} from '../engine/index.ts';
import type { GoalComponent, TaskDependency } from '../engine/index.ts';

// ── Component type → executor subKind mapping ─────────────────────────────────
// Each entry must match a key in tool-coordinator.ts coordinateCoding toolMap.

const TYPE_TO_SUBKIND: Record<string, string> = {
  frontend:   'generate_page',
  backend:    'generate_route',
  api:        'generate_rest_api',
  database:   'generate_schema',
  auth:       'generate_auth',
  crud:       'generate_crud_api',
  component:  'generate_component',
  storage:    'generate_module',
  testing:    'tests',
  deployment: 'run_script',
  planning:   'generate_page',
  finalize:   'generate_page',
  generic:    'generate_generic_file',
};

// ── Component → task mapping ──────────────────────────────────────────────────

function componentToTask(
  component: GoalComponent,
  phaseIndex: number,
  dependencies: string[],
): PlannedTask {
  const id      = makeTaskId(component.type);
  const subKind = TYPE_TO_SUBKIND[component.type] ?? 'generate_page';
  return {
    id,
    label:       `${component.type}: ${component.label}`,
    description: `Execute ${component.type} work for: ${component.label}`,
    phase:       phaseIndex,
    priority:    component.weight >= 0.8 ? 'critical'
               : component.weight >= 0.5 ? 'high'
               : component.weight >= 0.3 ? 'normal'
               : 'low',
    dependencies,
    toolName:   `execute_${component.type}_task`,
    input: {
      goal:      component.label,
      type:      component.type,
      subKind,
      phaseIndex,
    },
    timeoutMs:  60_000,
    retryLimit: 2,
    estimatedMs: Math.round(component.weight * 30_000),
  };
}

// ── Dependency → ID map builder ───────────────────────────────────────────────

function buildDependencyMap(
  tasks: PlannedTask[],
  rawDeps: TaskDependency[],
): Map<string, string[]> {
  const labelToId = new Map<string, string>();
  for (const t of tasks) {
    const label = t.label.split(': ')[1] ?? t.label;
    labelToId.set(label.toLowerCase(), t.id);
  }

  const depMap = new Map<string, string[]>();
  for (const dep of rawDeps) {
    const fromId = labelToId.get(dep.from.toLowerCase());
    const toId   = labelToId.get(dep.to.toLowerCase());
    if (fromId && toId) {
      const current = depMap.get(fromId) ?? [];
      if (!current.includes(toId)) current.push(toId);
      depMap.set(fromId, current);
    }
  }
  return depMap;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildTaskList(
  goal:      string,
  projectId: string,
): Promise<PlannedTask[]> {
  const normalised = normaliseGoal(goal);
  const analysis   = analyzeGoal(normalised);
  const rawDeps    = detectDependencies(analysis.components);

  // First pass: create tasks without cross-dependencies
  const tasks: PlannedTask[] = analysis.components.map((comp, i) =>
    componentToTask(comp, i, []),
  );

  // Second pass: wire cross-dependencies
  const depMap = buildDependencyMap(tasks, rawDeps);
  for (const task of tasks) {
    const deps = depMap.get(task.id);
    if (deps) task.dependencies = deps;
  }

  void projectId;
  return tasks;
}
