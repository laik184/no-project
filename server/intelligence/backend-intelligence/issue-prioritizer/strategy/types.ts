export interface Issue {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
}

export interface PriorityIssue {
  readonly id: string;
  readonly priority: number;
}

export interface PriorityResult {
  readonly sortedIssues: readonly PriorityIssue[];
}

// ── Derived form of Issue after priority resolution ───────────────────────────
//
// Defined here (not inside plan.util) so all agents can share a single
// stable contract without coupling to the utility layer.

export interface PrioritizedIssue extends Issue {
  readonly priority: number;
}

export type StrategyCategory =
  | "database"
  | "performance"
  | "security"
  | "reliability"
  | "api"
  | "code-quality"
  | "testing"
  | "observability";

export interface FixStrategy {
  readonly issueId: string;
  readonly strategy: string;
  readonly priority: number;
  readonly category: StrategyCategory;
}

export interface StrategyPlan {
  readonly issueId: string;
  readonly strategy: string;
  readonly steps: readonly string[];
  readonly priority: number;
}

export interface FinalStrategyOutput {
  readonly plans: readonly StrategyPlan[];
  readonly totalSteps: number;
}
