/**
 * server/engine/planning/index.ts
 *
 * Pure goal-analysis engine — no I/O, no tool calls, no side effects.
 * Converts a natural-language goal string into structured components
 * and dependency/parallelism metadata consumed by the planner agent.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComponentType =
  | 'frontend'
  | 'backend'
  | 'api'
  | 'database'
  | 'auth'
  | 'storage'
  | 'testing'
  | 'deployment'
  | 'generic';

export interface GoalComponent {
  type:   ComponentType;
  label:  string;
  weight: number;          // 0–1, higher = more critical / complex
}

export interface TaskDependency {
  from: string;            // component label that depends on…
  to:   string;            // …this component label
}

export interface GoalAnalysis {
  components:  GoalComponent[];
  rawGoal:     string;
  complexity:  'simple' | 'moderate' | 'complex';
}

// ── Keyword maps ──────────────────────────────────────────────────────────────

const TYPE_KEYWORDS: Array<[ComponentType, string[]]> = [
  ['frontend',   ['ui', 'frontend', 'react', 'vue', 'angular', 'page', 'component', 'layout', 'css', 'style', 'html', 'dashboard', 'interface', 'view']],
  ['backend',    ['backend', 'server', 'express', 'fastapi', 'django', 'node', 'api server', 'rest server', 'service']],
  ['api',        ['api', 'endpoint', 'route', 'rest', 'graphql', 'webhook', 'handler']],
  ['database',   ['database', 'db', 'postgres', 'mysql', 'sqlite', 'mongo', 'schema', 'migration', 'table', 'model', 'drizzle', 'orm', 'query']],
  ['auth',       ['auth', 'login', 'signup', 'register', 'password', 'jwt', 'session', 'oauth', 'permission', 'role', 'user management']],
  ['storage',    ['storage', 'file upload', 's3', 'bucket', 'blob', 'image upload', 'object store']],
  ['testing',    ['test', 'spec', 'jest', 'vitest', 'unit test', 'e2e', 'playwright', 'cypress']],
  ['deployment', ['deploy', 'docker', 'ci', 'cd', 'pipeline', 'container', 'kubernetes', 'hosting']],
];

const NATURAL_ORDER: ComponentType[] = [
  'database', 'auth', 'storage', 'backend', 'api', 'frontend', 'testing', 'deployment', 'generic',
];

// ── Inherent dependency rules ─────────────────────────────────────────────────
// When both sides are present, `from` depends on `to`.

const INHERENT_DEPS: Array<[ComponentType, ComponentType]> = [
  ['frontend',   'api'],
  ['frontend',   'backend'],
  ['api',        'database'],
  ['backend',    'database'],
  ['auth',       'database'],
  ['frontend',   'auth'],
  ['api',        'auth'],
  ['storage',    'backend'],
  ['testing',    'frontend'],
  ['testing',    'backend'],
  ['deployment', 'backend'],
  ['deployment', 'frontend'],
];

// ── analyzeGoal ───────────────────────────────────────────────────────────────

export function analyzeGoal(goal: string): GoalAnalysis {
  const lower = goal.toLowerCase();
  const found  = new Map<ComponentType, GoalComponent>();

  for (const [type, keywords] of TYPE_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        if (!found.has(type)) {
          found.set(type, {
            type,
            label:  deriveLabel(type, goal),
            weight: deriveWeight(type),
          });
        }
        break;
      }
    }
  }

  // Always include at least a generic component if nothing matched
  if (found.size === 0) {
    found.set('generic', { type: 'generic', label: trimGoal(goal), weight: 0.5 });
  }

  // Sort by natural build order
  const components = [...found.values()].sort(
    (a, b) => NATURAL_ORDER.indexOf(a.type) - NATURAL_ORDER.indexOf(b.type),
  );

  const n = components.length;
  const complexity: GoalAnalysis['complexity'] =
    n <= 2 ? 'simple' : n <= 5 ? 'moderate' : 'complex';

  return { components, rawGoal: goal, complexity };
}

// ── detectDependencies ────────────────────────────────────────────────────────

export function detectDependencies(components: GoalComponent[]): TaskDependency[] {
  const typeSet = new Map<ComponentType, GoalComponent>();
  for (const c of components) typeSet.set(c.type, c);

  const deps: TaskDependency[] = [];

  for (const [fromType, toType] of INHERENT_DEPS) {
    const fromComp = typeSet.get(fromType);
    const toComp   = typeSet.get(toType);
    if (fromComp && toComp) {
      deps.push({ from: fromComp.label, to: toComp.label });
    }
  }

  return deps;
}

// ── orderComponents ───────────────────────────────────────────────────────────

export function orderComponents(
  components: GoalComponent[],
  deps:       TaskDependency[],
): GoalComponent[] {
  const labelToComp = new Map(components.map((c) => [c.label, c]));
  const inDegree    = new Map(components.map((c) => [c.label, 0]));
  const adjOut      = new Map(components.map((c) => [c.label, [] as string[]]));

  // Build graph: dep.from depends on dep.to → dep.to must come first
  for (const dep of deps) {
    if (labelToComp.has(dep.from) && labelToComp.has(dep.to)) {
      adjOut.get(dep.to)!.push(dep.from);
      inDegree.set(dep.from, (inDegree.get(dep.from) ?? 0) + 1);
    }
  }

  const queue   = components.filter((c) => (inDegree.get(c.label) ?? 0) === 0);
  const ordered: GoalComponent[] = [];

  while (queue.length > 0) {
    // Pick by natural order within queue
    queue.sort((a, b) => NATURAL_ORDER.indexOf(a.type) - NATURAL_ORDER.indexOf(b.type));
    const node = queue.shift()!;
    ordered.push(node);

    for (const nextLabel of adjOut.get(node.label) ?? []) {
      const deg = (inDegree.get(nextLabel) ?? 1) - 1;
      inDegree.set(nextLabel, deg);
      if (deg === 0) {
        const comp = labelToComp.get(nextLabel);
        if (comp) queue.push(comp);
      }
    }
  }

  // Append any remaining (cycle fallback)
  for (const c of components) {
    if (!ordered.includes(c)) ordered.push(c);
  }

  return ordered;
}

// ── findParallelizable ────────────────────────────────────────────────────────

export function findParallelizable(
  components: GoalComponent[],
  deps:       TaskDependency[],
): GoalComponent[][] {
  const depSet = new Set(deps.map((d) => `${d.from}|${d.to}`));
  const groups: GoalComponent[][] = [];
  const placed  = new Set<string>();

  for (const a of components) {
    if (placed.has(a.label)) continue;
    const group = [a];
    placed.add(a.label);

    for (const b of components) {
      if (placed.has(b.label)) continue;
      const abDep = depSet.has(`${a.label}|${b.label}`);
      const baDep = depSet.has(`${b.label}|${a.label}`);
      if (!abDep && !baDep) {
        group.push(b);
        placed.add(b.label);
      }
    }

    if (group.length > 1) groups.push(group);
  }

  return groups;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function deriveLabel(type: ComponentType, goal: string): string {
  const short = trimGoal(goal);
  const prefix: Record<ComponentType, string> = {
    frontend:   'Frontend UI',
    backend:    'Backend Service',
    api:        'API Layer',
    database:   'Database',
    auth:       'Authentication',
    storage:    'File Storage',
    testing:    'Test Suite',
    deployment: 'Deployment',
    generic:    short,
  };
  return prefix[type] ?? short;
}

function deriveWeight(type: ComponentType): number {
  const weights: Record<ComponentType, number> = {
    database:   0.9,
    auth:       0.8,
    backend:    0.8,
    api:        0.7,
    frontend:   0.7,
    storage:    0.5,
    testing:    0.4,
    deployment: 0.4,
    generic:    0.5,
  };
  return weights[type] ?? 0.5;
}

function trimGoal(goal: string): string {
  return goal.length > 40 ? goal.slice(0, 37) + '...' : goal;
}
