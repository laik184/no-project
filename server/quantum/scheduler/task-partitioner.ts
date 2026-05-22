/**
 * task-partitioner.ts
 *
 * Decomposes a high-level goal into parallel execution strategies.
 * Each partition describes one independent approach to solving the goal.
 * Heuristics are deterministic — same input always produces same partitions.
 */

import type { ExecutionStrategy, QuantumTriggerCondition } from "../types/quantum.types.ts";

// ── Strategy catalogue ────────────────────────────────────────────────────────

const STRATEGY_LIBRARY: ExecutionStrategy[] = [
  {
    id: "jwt-auth",      name: "JWT Auth Strategy",
    description: "Stateless JWT-based authentication",
    approach: "jwt", priority: 3, tags: ["auth", "stateless"],
  },
  {
    id: "session-auth",  name: "Session Auth Strategy",
    description: "Server-side session authentication",
    approach: "session", priority: 2, tags: ["auth", "stateful"],
  },
  {
    id: "redux-state",   name: "Redux State Management",
    description: "Centralised Redux store",
    approach: "redux", priority: 2, tags: ["state", "predictable"],
  },
  {
    id: "zustand-state", name: "Zustand State Management",
    description: "Lightweight Zustand hooks",
    approach: "zustand", priority: 3, tags: ["state", "lightweight"],
  },
  {
    id: "context-state", name: "React Context State",
    description: "Built-in React Context + useReducer",
    approach: "context", priority: 1, tags: ["state", "builtin"],
  },
  {
    id: "microservice",  name: "Microservice Architecture",
    description: "Split into independent services",
    approach: "microservice", priority: 2, tags: ["arch", "distributed"],
  },
  {
    id: "monolith",      name: "Modular Monolith Architecture",
    description: "Single deployable with clear module boundaries",
    approach: "monolith", priority: 3, tags: ["arch", "simple"],
  },
  {
    id: "rest-api",      name: "REST API Design",
    description: "Resource-oriented REST endpoints",
    approach: "rest", priority: 3, tags: ["api", "rest"],
  },
  {
    id: "graphql-api",   name: "GraphQL API Design",
    description: "Flexible query-based GraphQL layer",
    approach: "graphql", priority: 2, tags: ["api", "graphql"],
  },
];

// ── Goal analysis ─────────────────────────────────────────────────────────────

export function detectTriggerConditions(goal: string): QuantumTriggerCondition[] {
  const lower  = goal.toLowerCase();
  const conditions: QuantumTriggerCondition[] = [];

  if (lower.includes("refactor") || lower.includes("restructure"))  conditions.push("refactor");
  if (lower.includes("architecture") || lower.includes("design"))   conditions.push("architecture_generation");
  if (lower.includes("module") || lower.includes("system"))         conditions.push("multi_module");
  if (lower.split(" ").length > 20)                                 conditions.push("high_complexity");

  return conditions;
}

export function shouldUseQuantum(goal: string, fileCount?: number): boolean {
  const conditions = detectTriggerConditions(goal);
  if (conditions.length >= 2) return true;
  if (fileCount && fileCount > 50) return true;
  return false;
}

// ── Partitioner ───────────────────────────────────────────────────────────────

export interface PartitionResult {
  strategies: ExecutionStrategy[];
  rationale:  string;
}

export function partitionGoal(
  goal:        string,
  maxPaths:    number = 3,
  overrides?:  string[],
): PartitionResult {
  // If explicit overrides provided, use them
  if (overrides && overrides.length > 0) {
    const strategies = STRATEGY_LIBRARY.filter(s => overrides.includes(s.id));
    if (strategies.length > 0) {
      return {
        strategies: strategies.slice(0, maxPaths),
        rationale:  `Explicit strategy overrides: ${overrides.join(", ")}`,
      };
    }
  }

  const lower  = goal.toLowerCase();
  let matched: ExecutionStrategy[] = [];

  // Tag-based matching
  if (lower.includes("auth"))        matched.push(...STRATEGY_LIBRARY.filter(s => s.tags.includes("auth")));
  if (lower.includes("state"))       matched.push(...STRATEGY_LIBRARY.filter(s => s.tags.includes("state")));
  if (lower.includes("api"))         matched.push(...STRATEGY_LIBRARY.filter(s => s.tags.includes("api")));
  if (lower.includes("architecture")) matched.push(...STRATEGY_LIBRARY.filter(s => s.tags.includes("arch")));

  // Deduplicate
  const seen = new Set<string>();
  matched = matched.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });

  // Fill remaining slots with highest-priority strategies
  if (matched.length < maxPaths) {
    const remaining = STRATEGY_LIBRARY
      .filter(s => !seen.has(s.id))
      .sort((a, b) => b.priority - a.priority);
    matched.push(...remaining.slice(0, maxPaths - matched.length));
  }

  return {
    strategies: matched.slice(0, maxPaths),
    rationale:  `Auto-matched ${matched.length} strategies for goal`,
  };
}
