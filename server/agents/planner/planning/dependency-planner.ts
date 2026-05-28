/**
 * server/agents/planner/planning/dependency-planner.ts
 *
 * Resolves and validates dependency ordering for the execution plan.
 * Delegates cycle detection and validation to the dependency-validator.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type { PlannedTask } from '../types/planner.types.ts';
import { validateDependencies } from '../validation/dependency-validator.ts';
import { topoSort } from '../utils/planning-utils.ts';
import {
  orderComponents,
  detectDependencies,
} from '../../../engine/planning/index.ts';
import type { GoalComponent } from '../../../engine/planning/index.ts';

export interface DependencyResolution {
  orderedTasks: PlannedTask[];
  errors:       string[];
  warnings:     string[];
}

// ── Main export ───────────────────────────────────────────────────────────────

export function resolveDependencies(
  tasks:      readonly PlannedTask[],
  components: readonly GoalComponent[],
): DependencyResolution {
  // 1. Validate dependency graph integrity (cycle detection, unknown refs)
  const validation = validateDependencies(tasks);
  if (!validation.valid) {
    return {
      orderedTasks: [...tasks],
      errors:       validation.errors,
      warnings:     validation.warnings,
    };
  }

  // 2. Use engine's component ordering as a secondary hint
  // engine functions expect mutable arrays — spread to satisfy the type
  const mutableComponents = [...components];
  const engineDeps        = detectDependencies(mutableComponents);
  const orderedComponents = orderComponents(mutableComponents, engineDeps);

  // Build a priority boost map from engine ordering
  const orderBoost = new Map<string, number>();
  orderedComponents.forEach((comp, i) => orderBoost.set(comp.label.toLowerCase(), i));

  // 3. Topological sort on task dependency graph
  const sortedIds = topoSort([...tasks]);
  const taskById  = new Map(tasks.map((t) => [t.id, t]));

  const orderedTasks = sortedIds
    .map((id) => taskById.get(id))
    .filter((t): t is PlannedTask => t !== undefined);

  // 4. Secondary sort within same topo level by engine ordering hint
  orderedTasks.sort((a, b) => {
    const aLabel = (a.label.split(': ')[1] ?? a.label).toLowerCase();
    const bLabel = (b.label.split(': ')[1] ?? b.label).toLowerCase();
    const aBoost = orderBoost.get(aLabel) ?? 999;
    const bBoost = orderBoost.get(bLabel) ?? 999;
    return aBoost - bBoost;
  });

  return {
    orderedTasks,
    errors:   [],
    warnings: validation.warnings,
  };
}
