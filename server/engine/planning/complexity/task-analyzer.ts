/**
 * task-analyzer.ts
 *
 * Analyzes a goal string into structured components, verbs, and entities.
 * Pure function — no LLM, no I/O, deterministic.
 */

import type { GoalAnalysis, GoalComponent, TaskCategory } from "./planning-types.ts";

// ── Component keyword maps ────────────────────────────────────────────────────

const COMPONENT_KEYWORDS: Record<TaskCategory, string[]> = {
  frontend:      ["ui", "component", "page", "react", "css", "style", "tailwind", "layout", "view", "modal", "sidebar", "navbar", "form", "button", "dashboard", "design"],
  backend:       ["api", "server", "express", "endpoint", "route", "controller", "middleware", "rest", "graphql", "websocket"],
  database:      ["database", "db", "postgres", "sql", "schema", "table", "migration", "drizzle", "orm", "query", "model", "mongodb"],
  auth:          ["auth", "login", "logout", "register", "signup", "session", "jwt", "oauth", "password", "user management"],
  api:           ["api", "fetch", "axios", "http", "request", "response", "integration", "third-party", "webhook"],
  deployment:    ["deploy", "production", "hosting", "docker", "ci/cd", "build", "release", "environment"],
  testing:       ["test", "spec", "jest", "vitest", "playwright", "e2e", "unit test", "coverage"],
  infrastructure:["config", "env", "dotenv", "nginx", "proxy", "ssl", "domain", "dns"],
  refactor:      ["refactor", "clean up", "optimize", "restructure", "rename", "extract", "consolidate"],
  unknown:       [],
};

const ACTION_VERBS = [
  "build", "create", "add", "implement", "integrate", "setup", "configure",
  "fix", "update", "refactor", "deploy", "connect", "fetch", "save",
  "display", "generate", "migrate", "test", "validate", "protect",
];

// ── Core analyzer ─────────────────────────────────────────────────────────────

export function analyzeGoal(goal: string): GoalAnalysis {
  const lower = goal.toLowerCase();
  const words = lower.split(/\s+/);

  // Find action verbs
  const actionVerbs = ACTION_VERBS.filter(v => lower.includes(v));

  // Detect components
  const componentMap = new Map<TaskCategory, number>();
  for (const [cat, keywords] of Object.entries(COMPONENT_KEYWORDS) as [TaskCategory, string[]][]) {
    if (cat === "unknown") continue;
    const hits = keywords.filter(kw => lower.includes(kw));
    if (hits.length > 0) {
      componentMap.set(cat, hits.length);
    }
  }

  const components: GoalComponent[] = [...componentMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, hitCount]) => ({
      type,
      label: type,
      weight: Math.min(1.0, hitCount / 3),
    }));

  // Extract entities (capitalized words, tech names)
  const entities = words
    .filter(w => /^[A-Z][a-z]+/.test(w) || /react|node|next|vite|postgres|redis/i.test(w))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  // Estimate file/command counts
  const estimatedFiles    = Math.max(1, components.length * 2 + Math.floor(words.length / 20));
  const estimatedCommands = Math.max(1, actionVerbs.length + (componentMap.has("database") ? 2 : 0));

  return {
    raw:               goal,
    wordCount:         words.length,
    components,
    actionVerbs,
    entities,
    isAmbiguous:       components.length === 0 && words.length < 8,
    estimatedFiles,
    estimatedCommands,
  };
}

/** Count how many distinct task categories a goal spans. */
export function componentCount(analysis: GoalAnalysis): number {
  return analysis.components.length;
}
