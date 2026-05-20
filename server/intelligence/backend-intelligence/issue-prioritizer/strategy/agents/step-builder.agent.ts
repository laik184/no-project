import { deduplicateSteps } from "../utils/plan.util.js";
import type { FixStrategy, StrategyPlan } from "../types.js";

const STEP_TEMPLATES: Readonly<Record<FixStrategy["category"], readonly string[]>> = Object.freeze({
  database: Object.freeze([
    "Identify affected queries and repositories",
    "Apply schema or index updates where required",
    "Implement eager loading or batching in repository layer",
    "Validate query latency with integration tests",
  ]),
  performance: Object.freeze([
    "Profile critical request paths to locate bottlenecks",
    "Optimize hot-path logic in service layer",
    "Add caching or batching for repeated expensive operations",
    "Verify latency and throughput targets with load tests",
  ]),
  security: Object.freeze([
    "Review vulnerable entry points and threat vectors",
    "Enforce validation and authorization checks",
    "Replace unsafe query or serialization patterns",
    "Run security regression tests for patched flows",
  ]),
  reliability: Object.freeze([
    "Map failure-prone dependencies and timeout boundaries",
    "Add retry, circuit-breaker, or fallback logic",
    "Harden transaction and idempotency guarantees",
    "Validate stability with resilience and chaos tests",
  ]),
  api: Object.freeze([
    "Document impacted endpoint contracts",
    "Implement service and controller updates",
    "Introduce backward-compatible contract guards",
    "Validate clients against updated API contract tests",
  ]),
  "code-quality": Object.freeze([
    "Locate code hotspots causing maintenance friction",
    "Refactor modules to improve separation of concerns",
    "Remove dead code and simplify branching logic",
    "Run unit and integration tests to confirm behavior parity",
  ]),
  testing: Object.freeze([
    "Identify risk-critical scenarios with low test coverage",
    "Add unit tests for domain edge cases",
    "Add integration tests across service boundaries",
    "Enable regression suite for future release gating",
  ]),
  observability: Object.freeze([
    "Define missing metrics, logs, and traces for the issue path",
    "Implement instrumentation at service and controller boundaries",
    "Set actionable alert thresholds and dashboards",
    "Verify signal quality during controlled test traffic",
  ]),
});

export function buildPlanSteps(strategies: readonly FixStrategy[]): readonly StrategyPlan[] {
  return Object.freeze(
    strategies.map((strategy) => {
      const templateSteps = STEP_TEMPLATES[strategy.category];
      const contextualized = templateSteps.map(
        (step, index) => `Step ${index + 1}: ${step}`,
      );

      return Object.freeze({
        issueId: strategy.issueId,
        strategy: strategy.strategy,
        priority: strategy.priority,
        steps: deduplicateSteps(contextualized),
      });
    }),
  );
}
