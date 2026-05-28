/**
 * server/agents/planner/validation/dependency-validator.ts
 *
 * Validates dependency ordering and detects cycles in execution plans.
 * Pure functions — no side effects, no tool calls.
 */

import type { PlannedTask, ValidationResult } from '../types/planner.types.ts';

// ── Cycle detection (DFS) ─────────────────────────────────────────────────────

type Color = 'white' | 'grey' | 'black';

export function detectCycle(tasks: readonly PlannedTask[]): string[] {
  const color = new Map<string, Color>();
  const cycles: string[] = [];

  for (const t of tasks) color.set(t.id, 'white');

  function dfs(id: string, path: string[]): void {
    color.set(id, 'grey');
    const task = tasks.find((t) => t.id === id);
    if (!task) { color.set(id, 'black'); return; }

    for (const dep of task.dependencies) {
      const c = color.get(dep);
      if (c === 'grey') {
        cycles.push(`cycle: ${[...path, id, dep].join(' → ')}`);
      } else if (c === 'white') {
        dfs(dep, [...path, id]);
      }
    }
    color.set(id, 'black');
  }

  for (const t of tasks) {
    if (color.get(t.id) === 'white') dfs(t.id, []);
  }

  return cycles;
}

// ── Dependency graph validation ───────────────────────────────────────────────

export function validateDependencies(tasks: readonly PlannedTask[]): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const ids = new Set(tasks.map((t) => t.id));

  // 1. Check all dependency IDs reference real tasks
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!ids.has(dep)) {
        errors.push(`task[${task.id}] depends on unknown task id "${dep}"`);
      }
    }
  }

  // 2. Detect circular dependencies
  const cycles = detectCycle(tasks);
  for (const c of cycles) {
    errors.push(`circular dependency detected — ${c}`);
  }

  // 3. Warn on deep dependency chains
  for (const task of tasks) {
    if (task.dependencies.length > 5) {
      warnings.push(`task[${task.id}] has ${task.dependencies.length} dependencies — may cause bottleneck`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Phase ordering validation ─────────────────────────────────────────────────

export function validatePhaseOrder(
  phases: ReadonlyArray<{ index: number; tasks: PlannedTask[] }>,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const seen = new Set<number>();
  for (const phase of phases) {
    if (seen.has(phase.index)) {
      errors.push(`duplicate phase index ${phase.index}`);
    }
    seen.add(phase.index);
    if (phase.tasks.length === 0) {
      warnings.push(`phase[${phase.index}] has no tasks`);
    }
  }

  // Ensure indices form a contiguous sequence starting at 0
  const sorted = [...seen].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i) {
      errors.push(`phase indices are not contiguous — gap at index ${i}`);
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
