import type { GoalInput, AnalyzedGoal, TaskCategory } from "../types.js";

const CATEGORY_KEYWORD_MAP: ReadonlyArray<readonly [TaskCategory, readonly string[]]> =
  Object.freeze([
    ["infrastructure",  Object.freeze(["server", "infrastructure", "deploy", "container", "docker", "cloud", "network", "port", "host"])],
    ["data-modeling",   Object.freeze(["entity", "model", "schema", "database", "table", "field", "relation", "orm", "migration"])],
    ["business-logic",  Object.freeze(["service", "logic", "rule", "workflow", "process", "calculate", "transform", "business"])],
    ["api-layer",       Object.freeze(["api", "route", "controller", "endpoint", "rest", "graphql", "request", "response", "handler"])],
    ["testing",         Object.freeze(["test", "spec", "unit", "integration", "coverage", "mock", "assertion", "e2e"])],
    ["documentation",   Object.freeze(["document", "readme", "comment", "doc", "describe", "annotation", "guide"])],
    ["deployment",      Object.freeze(["deploy", "publish", "release", "build", "ci", "pipeline", "production", "staging"])],
    ["configuration",   Object.freeze(["config", "env", "environment", "setting", "option", "variable", "dotenv"])],
  ]);

const MIN_KEYWORD_LENGTH = 3;

function extractScopeKeywords(goal: GoalInput): readonly string[] {
  const text = [
    goal.primaryObjective,
    ...goal.subObjectives,
    ...goal.requiredCapabilities,
  ].join(" ").toLowerCase();

  const words  = text.split(/\W+/);
  const unique = new Set<string>();

  for (const word of words) {
    const clean = word.trim();
    if (clean.length >= MIN_KEYWORD_LENGTH) unique.add(clean);
  }

  return Object.freeze([...unique].slice(0, 40));
}

function inferTaskCategories(
  scopeKeywords:       readonly string[],
  requiredCapabilities: readonly string[],
): readonly TaskCategory[] {
  const categories = new Set<TaskCategory>();
  const allText    = [...scopeKeywords, ...requiredCapabilities].join(" ").toLowerCase();

  for (const [category, keywords] of CATEGORY_KEYWORD_MAP) {
    const matched = keywords.some(kw => allText.includes(kw));
    if (matched) categories.add(category);
  }

  if (categories.size === 0) {
    categories.add("business-logic");
    categories.add("api-layer");
  }

  const priorityOrder: readonly TaskCategory[] = [
    "infrastructure",
    "configuration",
    "data-modeling",
    "business-logic",
    "api-layer",
    "testing",
    "documentation",
    "deployment",
  ];

  return Object.freeze(
    priorityOrder.filter(c => categories.has(c))
  );
}

function clampComplexity(raw: number): number {
  return Math.max(0, Math.min(1, Math.round(raw * 100) / 100));
}

export function analyzeGoal(goal: GoalInput): AnalyzedGoal {
  const scopeKeywords  = extractScopeKeywords(goal);
  const taskCategories = inferTaskCategories(scopeKeywords, goal.requiredCapabilities);

  return Object.freeze<AnalyzedGoal>({
    goalId:              goal.goalId,
    primaryObjective:    goal.primaryObjective,
    subObjectives:       Object.freeze([...goal.subObjectives]),
    taskCategories,
    estimatedComplexity: clampComplexity(goal.estimatedComplexity),
    constraints:         Object.freeze([...goal.constraints]),
    scopeKeywords,
  });
}
