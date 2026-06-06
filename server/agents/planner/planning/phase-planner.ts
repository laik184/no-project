/**
 * server/agents/planner/planning/phase-planner.ts
 *
 * Groups PlannedTasks into ordered ExecutionPhases.
 * Uses dependency ordering and parallelism detection.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type { PlannedTask, ExecutionPhase, ExecutionStrategy } from '../types/planner.types.ts';
import { topoSort } from '../utils/planning-utils.ts';
import { findParallelizable, detectDependencies } from '../engine/index.ts';
import type { GoalComponent } from '../engine/index.ts';

// ── Wave-based phase builder ──────────────────────────────────────────────────

/**
 * Build execution waves: each wave contains tasks whose dependencies
 * are fully satisfied by all prior waves.
 */
function buildWaves(tasks: readonly PlannedTask[]): PlannedTask[][] {
  const completed = new Set<string>();
  const remaining = [...tasks];
  const waves: PlannedTask[][] = [];

  while (remaining.length > 0) {
    const wave: PlannedTask[]  = [];
    const toRemove: number[]   = [];

    for (let i = 0; i < remaining.length; i++) {
      const task = remaining[i];
      const allDepsDone = task.dependencies.every((dep) => completed.has(dep));
      if (allDepsDone) {
        wave.push(task);
        toRemove.push(i);
      }
    }

    // Safety: if no task can be scheduled, break to avoid infinite loop
    if (wave.length === 0) break;

    for (const idx of toRemove.reverse()) remaining.splice(idx, 1);
    for (const t of wave) completed.add(t.id);
    waves.push(wave);
  }

  return waves;
}

// ── Strategy selection ────────────────────────────────────────────────────────

function pickStrategy(wave: PlannedTask[]): ExecutionStrategy {
  if (wave.length === 1) return 'sequential';
  const hasDeps = wave.some((t) => t.dependencies.length > 0);
  if (!hasDeps) return 'parallel';
  return 'wave';
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildExecutionPhases(
  tasks:      readonly PlannedTask[],
  components: readonly GoalComponent[],
): ExecutionPhase[] {
  // Sort tasks by topological order first
  const sortedIds = topoSort([...tasks]);
  const taskById  = new Map(tasks.map((t) => [t.id, t]));
  const sorted    = sortedIds
    .map((id) => taskById.get(id))
    .filter((t): t is PlannedTask => t !== undefined);

  // Get component deps to pass to findParallelizable
  const mutableComponents = [...components];
  const engineDeps        = detectDependencies(mutableComponents);
  const parallelGroups    = findParallelizable(mutableComponents, engineDeps);

  const parallelLabels = new Set(
    parallelGroups.flat().map((c) => c.label.toLowerCase()),
  );

  const waves: PlannedTask[][] = buildWaves(sorted);

  return waves.map((wave, index): ExecutionPhase => {
    const strategy    = pickStrategy(wave);
    const canParallel = wave.length > 1 &&
      wave.every((t) => {
        const label = (t.label.split(': ')[1] ?? t.label).toLowerCase();
        return parallelLabels.has(label);
      });

    return {
      index,
      label:      `Phase ${index + 1} — ${wave.map((t) => t.label).join(', ')}`,
      tasks:      wave,
      strategy:   canParallel ? 'parallel' : strategy,
      canParallel,
    };
  });
}
