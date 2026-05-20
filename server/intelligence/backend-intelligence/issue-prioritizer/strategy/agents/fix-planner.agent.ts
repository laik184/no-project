import { mergeDuplicateIssues } from "../utils/plan.util.js";
import type { FixStrategy, PriorityResult, StrategyCategory, Issue } from "../types.js";

const STRATEGY_RULES: ReadonlyArray<{
  readonly category: StrategyCategory;
  readonly keywords: readonly string[];
  readonly strategy: string;
}> = Object.freeze([
  {
    category: "database",
    keywords: ["n+1", "join", "slow query", "index", "database", "sql"],
    strategy: "Optimize data access with eager loading, batching, and index tuning",
  },
  {
    category: "security",
    keywords: ["auth", "token", "injection", "xss", "csrf", "permission"],
    strategy: "Harden security boundaries with validation, authorization checks, and safe query patterns",
  },
  {
    category: "reliability",
    keywords: ["timeout", "retry", "failure", "crash", "incident", "outage"],
    strategy: "Improve resilience through timeout guards, retries, and fallback handling",
  },
  {
    category: "api",
    keywords: ["api", "endpoint", "contract", "version", "serialization"],
    strategy: "Stabilize API behavior with contract alignment and backward-compatible changes",
  },
  {
    category: "observability",
    keywords: ["log", "trace", "metric", "monitor", "alert"],
    strategy: "Increase observability with structured telemetry and actionable alerts",
  },
  {
    category: "testing",
    keywords: ["test", "coverage", "regression"],
    strategy: "Expand automated testing for critical execution paths and regressions",
  },
  {
    category: "performance",
    keywords: ["latency", "throughput", "memory", "cpu", "performance"],
    strategy: "Reduce runtime overhead with targeted performance profiling and optimization",
  },
]);

const DEFAULT_STRATEGY = Object.freeze({
  category: "code-quality" as const,
  strategy: "Refactor backend module boundaries and remove technical debt hotspots",
});

function chooseStrategy(issue: Issue): Pick<FixStrategy, "strategy" | "category"> {
  const haystack = `${issue.title} ${issue.description ?? ""} ${(issue.tags ?? []).join(" ")}`.toLowerCase();

  for (const rule of STRATEGY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return {
        category: rule.category,
        strategy: rule.strategy,
      };
    }
  }

  return DEFAULT_STRATEGY;
}

export function planFixStrategies(
  issues: readonly Issue[],
  priorityResult: PriorityResult,
): readonly FixStrategy[] {
  const mergedIssues = mergeDuplicateIssues(issues, priorityResult);

  return Object.freeze(
    mergedIssues.map((issue) => {
      const planned = chooseStrategy(issue);

      return Object.freeze({
        issueId: issue.id,
        strategy: planned.strategy,
        priority: issue.priority,
        category: planned.category,
      });
    }),
  );
}
