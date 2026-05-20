/**
 * dependency-detector.ts
 *
 * Detects natural ordering constraints between task components.
 * Produces a dependency graph that the planner uses to sequence work.
 * Pure function — deterministic, no LLM.
 */

import type { GoalComponent, TaskDependency } from "./planning-types.ts";

// ── Dependency rules ──────────────────────────────────────────────────────────
// from → must come before → to

const DEPENDENCY_RULES: Array<{
  from:   string;
  to:     string;
  type:   TaskDependency["type"];
  reason: string;
}> = [
  { from: "database", to: "backend",  type: "requires", reason: "Backend needs DB schema before writing queries" },
  { from: "database", to: "auth",     type: "requires", reason: "Auth needs user table before login logic" },
  { from: "backend",  to: "frontend", type: "requires", reason: "Frontend needs API endpoints to call" },
  { from: "auth",     to: "frontend", type: "requires", reason: "Frontend auth flows need backend auth routes" },
  { from: "backend",  to: "api",      type: "requires", reason: "API client needs server endpoints defined first" },
  { from: "infrastructure", to: "backend", type: "requires", reason: "Config/env must be set before server starts" },
  { from: "backend",  to: "deployment", type: "requires", reason: "App must be built before deploying" },
  { from: "frontend", to: "testing",  type: "optional", reason: "Tests should run after UI is built" },
  { from: "backend",  to: "testing",  type: "optional", reason: "API tests need backend to exist" },
  { from: "refactor", to: "testing",  type: "optional", reason: "Test after refactor to verify no regressions" },
];

// ── Detector ──────────────────────────────────────────────────────────────────

export function detectDependencies(components: GoalComponent[]): TaskDependency[] {
  const componentTypes = new Set(components.map(c => c.type));
  const deps: TaskDependency[] = [];

  for (const rule of DEPENDENCY_RULES) {
    if (componentTypes.has(rule.from as any) && componentTypes.has(rule.to as any)) {
      deps.push({
        from:   rule.from,
        to:     rule.to,
        type:   rule.type,
        reason: rule.reason,
      });
    }
  }

  return deps;
}

/**
 * Topological sort of components based on detected dependencies.
 * Returns components in execution order.
 */
export function orderComponents(
  components: GoalComponent[],
  deps:       TaskDependency[],
): GoalComponent[] {
  const inDegree = new Map<string, number>();
  const adj      = new Map<string, string[]>();

  for (const c of components) {
    inDegree.set(c.type, 0);
    adj.set(c.type, []);
  }

  for (const dep of deps) {
    if (dep.type === "optional") continue;  // optional deps don't force ordering
    adj.get(dep.from)?.push(dep.to);
    inDegree.set(dep.to, (inDegree.get(dep.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [type, deg] of inDegree) {
    if (deg === 0) queue.push(type);
  }

  const ordered: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    ordered.push(cur);
    for (const neighbor of adj.get(cur) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Preserve original order for any components not in the ordering
  const typeIndex = new Map(ordered.map((t, i) => [t, i]));
  return [...components].sort((a, b) => {
    const ia = typeIndex.get(a.type) ?? 999;
    const ib = typeIndex.get(b.type) ?? 999;
    return ia - ib;
  });
}

/** Find components that CAN run in parallel (no ordering dependency between them). */
export function findParallelizable(
  components: GoalComponent[],
  deps:       TaskDependency[],
): GoalComponent[][] {
  const hardDeps = deps.filter(d => d.type === "requires");
  const waves: GoalComponent[][] = [];
  const placed = new Set<string>();

  let remaining = [...components];
  while (remaining.length > 0) {
    const wave = remaining.filter(c =>
      !hardDeps.some(d => d.to === c.type && !placed.has(d.from))
    );
    if (wave.length === 0) break;  // cycle detection
    waves.push(wave);
    wave.forEach(c => placed.add(c.type));
    remaining = remaining.filter(c => !placed.has(c.type));
  }

  return waves;
}
