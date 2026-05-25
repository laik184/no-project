/**
 * intent-classifier.ts
 *
 * Classifies a goal string into an ExecutionStrategy and StrategyRationale.
 * Single responsibility: strategy selection only — no graph construction, no LLM calls.
 *
 * Classification logic (ordered by priority):
 *   1. QUANTUM   — exploratory / research / uncertain / compare approaches
 *   2. SWARM     — ≥2 distinct specialist domains detected
 *   3. DAG       — multi-step with clear dependencies, single domain
 *   4. PLANNED   — moderate complexity, sequential planning required
 *   5. TOOL_LOOP — simple query/lookup, no file writes expected
 *
 * All classification is deterministic keyword-signal scoring — no LLM calls.
 * Confidence is derived from signal strength overlap.
 */

import type { ExecutionStrategy, StrategyRationale, SpecialistDomainHint } from "./intent-graph-types.ts";

// ── Signal tables ─────────────────────────────────────────────────────────────

const QUANTUM_SIGNALS = [
  "compare approaches", "explore options", "research", "evaluate alternatives",
  "find the best way", "uncertainty", "experiment", "prototype",
  "multiple solutions", "investigate", "brainstorm",
];

const SWARM_SIGNALS = [
  "full-stack", "fullstack", "end-to-end", "database and", "frontend and backend",
  "auth", "authentication", "authorization", "deploy", "migration and",
  "schema and", "api and ui", "test and", "security and",
];

const DAG_SIGNALS = [
  "then", "after that", "first", "next", "finally", "step by step",
  "in order", "depends on", "before", "sequentially", "chain",
  "pipeline", "workflow", "multiple files", "several",
];

const PLANNED_SIGNALS = [
  "create", "build", "implement", "add feature", "refactor", "redesign",
  "update", "modify", "extend", "integrate", "configure", "set up",
];

const TOOL_LOOP_SIGNALS = [
  "what is", "how does", "explain", "show me", "list", "find", "check",
  "debug", "why", "where is", "look at", "read", "print", "fetch",
];

// ── Domain signal tables ───────────────────────────────────────────────────────

const DOMAIN_SIGNALS: Record<SpecialistDomainHint, string[]> = {
  database:     ["database", "schema", "migration", "sql", "query", "table", "postgres", "drizzle"],
  backend:      ["api", "route", "endpoint", "server", "express", "controller", "service", "handler"],
  frontend:     ["ui", "component", "react", "page", "view", "css", "tailwind", "button", "form"],
  security:     ["auth", "jwt", "token", "password", "permission", "role", "csrf", "xss", "sanitize"],
  runtime:      ["deploy", "workflow", "port", "process", "restart", "environment", "npm", "build"],
  verification: ["test", "verify", "validate", "check", "assertion", "lint", "typecheck", "coverage"],
  fullstack:    ["full-stack", "fullstack", "end-to-end", "e2e", "integration", "monorepo"],
};

// ── Scoring helpers ───────────────────────────────────────────────────────────

function countSignals(goal: string, signals: string[]): number {
  const lower = goal.toLowerCase();
  return signals.filter(s => lower.includes(s)).length;
}

function detectDomains(goal: string): SpecialistDomainHint[] {
  const found: SpecialistDomainHint[] = [];
  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    if (countSignals(goal, signals) > 0) found.push(domain as SpecialistDomainHint);
  }
  return found;
}

function complexityScore(goal: string): number {
  const wordCount    = goal.split(/\s+/).length;
  const wordScore    = Math.min(wordCount / 2, 30);
  const dagScore     = countSignals(goal, DAG_SIGNALS)     * 5;
  const swarmScore   = countSignals(goal, SWARM_SIGNALS)   * 8;
  const plannedScore = countSignals(goal, PLANNED_SIGNALS) * 3;
  return Math.min(Math.round(wordScore + dagScore + swarmScore + plannedScore), 100);
}

// ── Main classifier ───────────────────────────────────────────────────────────

export function classifyIntent(goal: string): StrategyRationale {
  const domains     = detectDomains(goal);
  const complexity  = complexityScore(goal);
  const reasons:    string[] = [];

  // 1. QUANTUM — exploratory intent
  const quantumHits = countSignals(goal, QUANTUM_SIGNALS);
  if (quantumHits >= 1) {
    reasons.push(`Exploratory intent detected (${quantumHits} quantum signals)`);
    return {
      strategy:       "quantum",
      confidence:     Math.min(0.5 + quantumHits * 0.1, 0.95),
      reasons,
      domainCount:    domains.length,
      complexityScore: complexity,
    };
  }

  // 2. SWARM — multi-domain parallel execution required
  if (domains.length >= 2) {
    reasons.push(`Multi-domain goal detected: [${domains.join(", ")}]`);
    if (complexity >= 40) reasons.push(`High complexity score: ${complexity}`);
    return {
      strategy:       "swarm",
      confidence:     Math.min(0.6 + domains.length * 0.08, 0.95),
      reasons,
      domainCount:    domains.length,
      complexityScore: complexity,
    };
  }

  // 3. DAG — clear step ordering with dependencies
  const dagHits = countSignals(goal, DAG_SIGNALS);
  if (dagHits >= 2 || complexity >= 50) {
    reasons.push(`Sequential dependency signals: ${dagHits} hits, complexity=${complexity}`);
    return {
      strategy:       "dag",
      confidence:     Math.min(0.5 + dagHits * 0.08, 0.90),
      reasons,
      domainCount:    domains.length,
      complexityScore: complexity,
    };
  }

  // 4. PLANNED — moderate build/create intent
  const plannedHits = countSignals(goal, PLANNED_SIGNALS);
  if (plannedHits >= 1 || complexity >= 20) {
    reasons.push(`Build intent detected (${plannedHits} planned signals)`);
    return {
      strategy:       "planned",
      confidence:     Math.min(0.5 + plannedHits * 0.07, 0.85),
      reasons,
      domainCount:    domains.length,
      complexityScore: complexity,
    };
  }

  // 5. TOOL_LOOP — simple query
  reasons.push("Simple query or lookup intent — no complex build signals");
  return {
    strategy:       "tool-loop",
    confidence:     0.80,
    reasons,
    domainCount:    domains.length,
    complexityScore: complexity,
  };
}

export { detectDomains };
