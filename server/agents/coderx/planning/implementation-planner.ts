/**
 * server/agents/coderx/planning/implementation-planner.ts
 *
 * Creates an implementation strategy from a CodingPlan.
 * Groups tasks into sequential or parallel phases.
 * Pure planning logic — no execution.
 */

import type {
  CodingPlan,
  CodingTask,
  ImplementationPlan,
  ImplementationPhase,
  CodingTaskKind,
} from '../types/coderx.types.ts';
import { generatePlanId, generatePhaseId } from '../utils/coding-utils.ts';

// ── Task kinds that can safely run in parallel ────────────────────────────────

const PARALLELIZABLE_KINDS = new Set<CodingTaskKind>([
  'analyze',
  'validate',
]);

// ── Phase grouping ────────────────────────────────────────────────────────────

export function buildImplementationPlan(codingPlan: CodingPlan): ImplementationPlan {
  const phases = groupTasksIntoPhases(codingPlan.tasks);

  return {
    planId:   generatePlanId(),
    strategy: deriveStrategy(codingPlan.tasks),
    phases,
  };
}

function groupTasksIntoPhases(tasks: CodingTask[]): ImplementationPhase[] {
  if (tasks.length === 0) return [];

  const phases: ImplementationPhase[] = [];
  let current: CodingTask[] = [];
  let currentParallel = false;

  for (const task of tasks) {
    const canParallel = PARALLELIZABLE_KINDS.has(task.kind);

    if (current.length === 0) {
      current.push(task);
      currentParallel = canParallel;
    } else if (canParallel === currentParallel) {
      current.push(task);
    } else {
      phases.push(buildPhase(current, currentParallel));
      current         = [task];
      currentParallel = canParallel;
    }
  }

  if (current.length > 0) {
    phases.push(buildPhase(current, currentParallel));
  }

  return phases;
}

function buildPhase(tasks: CodingTask[], parallel: boolean): ImplementationPhase {
  const name = parallel
    ? `Parallel: ${tasks.map((t) => t.kind).join(', ')}`
    : `Sequential: ${tasks.map((t) => t.kind).join(' → ')}`;

  return {
    phaseId:  generatePhaseId(),
    name,
    tasks,
    parallel,
  };
}

function deriveStrategy(tasks: CodingTask[]): string {
  const kinds = [...new Set(tasks.map((t) => t.kind))];
  if (kinds.includes('generate_rest_api') || kinds.includes('generate_route')) {
    return 'api-first';
  }
  if (kinds.includes('generate_component')) {
    return 'ui-first';
  }
  if (kinds.includes('refactor')) {
    return 'refactor';
  }
  return 'standard';
}
