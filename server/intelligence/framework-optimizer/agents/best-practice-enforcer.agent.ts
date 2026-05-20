import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runBestPracticeEnforcer(input: FrameworkSignals): OptimizationIssue[] {
  const best = input.bestPractices;
  if (!best) return [];

  const issues: OptimizationIssue[] = [];

  if ((best.antiPatterns?.length ?? 0) > 0) {
    issues.push({
      type: "best-practice",
      severity: "high",
      message: "Framework anti-patterns detected in the current implementation.",
      fix: "Refactor anti-patterns into framework-native patterns and lifecycle-safe APIs.",
    });
  }

  if ((best.ruleViolations?.length ?? 0) > 0) {
    issues.push({
      type: "best-practice",
      severity: "medium",
      message: "Framework best-practice rule violations found.",
      fix: "Apply rule-based linting and codemods to enforce conventions.",
    });
  }

  return issues;
}
