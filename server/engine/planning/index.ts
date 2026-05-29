/**
 * server/engine/planning/index.ts
 *
 * Rule-based goal analysis engine.
 * Parses a natural-language goal into structured components,
 * detects dependencies, and identifies parallelizable groups.
 *
 * Pure functions — no side-effects, no LLM calls, no I/O.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoalComponent {
  readonly type:   string;
  readonly label:  string;
  readonly weight: number;
  readonly tags:   readonly string[];
}

export interface GoalAnalysis {
  readonly goal:           string;
  readonly components:     GoalComponent[];
  readonly complexity:     'low' | 'medium' | 'high';
  readonly estimatedSteps: number;
}

export interface TaskDependency {
  readonly from: string;
  readonly to:   string;
  readonly type: 'sequential' | 'soft';
}

// ── Component type vocabulary ─────────────────────────────────────────────────

const COMPONENT_PATTERNS: Array<{
  type:    string;
  weight:  number;
  tags:    string[];
  match:   RegExp;
}> = [
  { type: 'auth',       weight: 0.9, tags: ['security'],    match: /\b(auth|login|logout|jwt|oauth|session|password|user.?management)\b/i },
  { type: 'database',   weight: 0.9, tags: ['data'],        match: /\b(database|db|sql|postgres|mysql|mongo|schema|migration|model)\b/i },
  { type: 'api',        weight: 0.8, tags: ['backend'],     match: /\b(api|rest|endpoint|route|controller|graphql|webhook)\b/i },
  { type: 'ui',         weight: 0.7, tags: ['frontend'],    match: /\b(ui|frontend|component|page|view|screen|form|dashboard|interface)\b/i },
  { type: 'deploy',     weight: 0.8, tags: ['ops'],         match: /\b(deploy|deployment|hosting|ci.?cd|pipeline|release|publish)\b/i },
  { type: 'test',       weight: 0.6, tags: ['quality'],     match: /\b(test|testing|spec|unit|integration|e2e|coverage)\b/i },
  { type: 'search',     weight: 0.7, tags: ['feature'],     match: /\b(search|filter|query|find|lookup|index)\b/i },
  { type: 'file',       weight: 0.6, tags: ['storage'],     match: /\b(file|upload|download|attachment|storage|blob|media|image)\b/i },
  { type: 'payment',    weight: 0.9, tags: ['commerce'],    match: /\b(payment|checkout|stripe|billing|subscription|invoice)\b/i },
  { type: 'email',      weight: 0.6, tags: ['comms'],       match: /\b(email|mail|smtp|notification|newsletter|sendgrid)\b/i },
  { type: 'realtime',   weight: 0.7, tags: ['feature'],     match: /\b(realtime|websocket|sse|live|stream|push|socket\.io)\b/i },
  { type: 'config',     weight: 0.5, tags: ['infra'],       match: /\b(config|configuration|env|environment|setting)\b/i },
  { type: 'build',      weight: 0.7, tags: ['build'],       match: /\b(build|scaffold|generate|create|setup|initialize|bootstrap)\b/i },
  { type: 'refactor',   weight: 0.6, tags: ['quality'],     match: /\b(refactor|clean|improve|optimize|fix|debug|rewrite)\b/i },
  { type: 'docs',       weight: 0.4, tags: ['docs'],        match: /\b(doc|documentation|readme|comment|jsdoc|swagger)\b/i },
];

// ── Goal analyzer ─────────────────────────────────────────────────────────────

export function analyzeGoal(goal: string): GoalAnalysis {
  const components: GoalComponent[] = [];

  for (const pattern of COMPONENT_PATTERNS) {
    if (pattern.match.test(goal)) {
      const match = goal.match(pattern.match);
      components.push({
        type:   pattern.type,
        label:  match ? match[0] : pattern.type,
        weight: pattern.weight,
        tags:   pattern.tags,
      });
    }
  }

  // If no patterns matched, create a generic "build" component
  if (components.length === 0) {
    components.push({
      type:   'build',
      label:  goal.slice(0, 80),
      weight: 0.7,
      tags:   ['general'],
    });
  }

  const complexity: GoalAnalysis['complexity'] =
    components.length >= 5 ? 'high' :
    components.length >= 3 ? 'medium' :
    'low';

  return {
    goal,
    components,
    complexity,
    estimatedSteps: components.length * 2,
  };
}

// ── Dependency detection ──────────────────────────────────────────────────────

const DEPENDENCY_RULES: Array<{ from: string; to: string }> = [
  { from: 'api',      to: 'database' },
  { from: 'auth',     to: 'database' },
  { from: 'ui',       to: 'api' },
  { from: 'payment',  to: 'auth' },
  { from: 'payment',  to: 'api' },
  { from: 'deploy',   to: 'test' },
  { from: 'deploy',   to: 'build' },
  { from: 'test',     to: 'build' },
  { from: 'realtime', to: 'api' },
  { from: 'search',   to: 'database' },
  { from: 'file',     to: 'api' },
  { from: 'email',    to: 'auth' },
];

export function detectDependencies(components: readonly GoalComponent[]): TaskDependency[] {
  const types = new Set(components.map(c => c.type));
  const deps: TaskDependency[] = [];

  for (const rule of DEPENDENCY_RULES) {
    if (types.has(rule.from) && types.has(rule.to)) {
      deps.push({ from: rule.from, to: rule.to, type: 'sequential' });
    }
  }

  return deps;
}

// ── Component ordering ────────────────────────────────────────────────────────

export function orderComponents(components: readonly GoalComponent[]): GoalComponent[] {
  const deps = detectDependencies(components);

  const dependsOn = new Map<string, Set<string>>();
  for (const c of components) dependsOn.set(c.type, new Set());
  for (const dep of deps) dependsOn.get(dep.from)?.add(dep.to);

  const remaining  = [...components];
  const resolved   = new Set<string>();
  const ordered:   GoalComponent[] = [];

  while (remaining.length > 0) {
    const before = remaining.length;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const c    = remaining[i];
      const deps = dependsOn.get(c.type) ?? new Set<string>();
      if ([...deps].every(d => resolved.has(d))) {
        ordered.push(c);
        resolved.add(c.type);
        remaining.splice(i, 1);
      }
    }
    if (remaining.length === before) {
      ordered.push(...remaining);
      break;
    }
  }

  return ordered;
}

// ── Parallelism detection ─────────────────────────────────────────────────────

export function findParallelizable(components: readonly GoalComponent[]): GoalComponent[][] {
  const ordered = orderComponents(components);
  const deps    = detectDependencies(components);
  const depMap  = new Map<string, Set<string>>();

  for (const c of ordered) depMap.set(c.type, new Set());
  for (const dep of deps)  depMap.get(dep.from)?.add(dep.to);

  const resolved = new Set<string>();
  const waves:   GoalComponent[][] = [];

  const remaining = [...ordered];
  while (remaining.length > 0) {
    const wave: GoalComponent[] = [];
    const toRemove: number[]    = [];

    for (let i = 0; i < remaining.length; i++) {
      const c    = remaining[i];
      const deps = depMap.get(c.type) ?? new Set<string>();
      if ([...deps].every(d => resolved.has(d))) {
        wave.push(c);
        toRemove.push(i);
      }
    }

    if (wave.length === 0) {
      waves.push([...remaining]);
      break;
    }

    wave.forEach(c => resolved.add(c.type));
    for (let i = toRemove.length - 1; i >= 0; i--) {
      remaining.splice(toRemove[i], 1);
    }

    waves.push(wave);
  }

  return waves;
}
