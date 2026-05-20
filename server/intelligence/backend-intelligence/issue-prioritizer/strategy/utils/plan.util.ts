import type { Issue, PrioritizedIssue, PriorityResult, StrategyPlan } from "../types.js";

const DEPENDENCY_BUCKETS: Readonly<Record<string, number>> = Object.freeze({
  schema:      10,
  migration:   10,
  repository:  20,
  query:       20,
  batching:    25,
  service:     30,
  transaction: 30,
  controller:  40,
  endpoint:    40,
  validation:  45,
  test:        90,
  metric:      95,
  monitor:     95,
  runbook:     98,
});

export function mergeDuplicateIssues(
  issues: readonly Issue[],
  priorityResult: PriorityResult,
): readonly PrioritizedIssue[] {
  const priorityMap = new Map<string, number>();

  for (const prioritized of priorityResult.sortedIssues) {
    const existing = priorityMap.get(prioritized.id);
    if (existing === undefined || prioritized.priority > existing) {
      priorityMap.set(prioritized.id, prioritized.priority);
    }
  }

  const deduped = new Map<string, PrioritizedIssue>();

  for (const issue of issues) {
    const candidate: PrioritizedIssue = Object.freeze({
      ...issue,
      priority: priorityMap.get(issue.id) ?? 0,
    });

    const existing = deduped.get(issue.id);
    if (existing === undefined || candidate.priority > existing.priority) {
      deduped.set(issue.id, candidate);
      continue;
    }

    if (candidate.priority === existing.priority) {
      const keepCandidate =
        `${candidate.title}${candidate.description ?? ""}`.localeCompare(
          `${existing.title}${existing.description ?? ""}`,
        ) < 0;

      if (keepCandidate) {
        deduped.set(issue.id, candidate);
      }
    }
  }

  return Object.freeze(
    [...deduped.values()].sort(
      (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
    ),
  );
}

export function deduplicateSteps(steps: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(steps.map((step) => step.trim()).filter(Boolean))]);
}

export function orderByDependencies(steps: readonly string[]): readonly string[] {
  const scored = steps.map((step, index) => {
    const lower = step.toLowerCase();
    let bucket = 60;

    for (const [token, tokenBucket] of Object.entries(DEPENDENCY_BUCKETS)) {
      if (lower.includes(token)) {
        bucket = Math.min(bucket, tokenBucket);
      }
    }

    return { step, bucket, index };
  });

  scored.sort((a, b) => a.bucket - b.bucket || a.index - b.index || a.step.localeCompare(b.step));
  return Object.freeze(scored.map((entry) => entry.step));
}

export function mergeAndOrderPlans(plans: readonly StrategyPlan[]): readonly StrategyPlan[] {
  const mergedByIssue = new Map<string, StrategyPlan>();

  for (const plan of plans) {
    const existing = mergedByIssue.get(plan.issueId);
    if (existing === undefined || plan.priority > existing.priority) {
      mergedByIssue.set(plan.issueId, plan);
      continue;
    }

    if (
      plan.priority === existing.priority &&
      plan.strategy.localeCompare(existing.strategy) < 0
    ) {
      mergedByIssue.set(plan.issueId, plan);
    }
  }

  return Object.freeze(
    [...mergedByIssue.values()].sort(
      (a, b) => b.priority - a.priority || a.issueId.localeCompare(b.issueId),
    ),
  );
}
