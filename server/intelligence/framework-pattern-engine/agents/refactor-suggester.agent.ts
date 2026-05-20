import type { AntiPattern, Suggestion, Violation } from "../types.js";

export function runRefactorSuggesterAgent(
  antiPatterns: readonly AntiPattern[],
  violations: readonly Violation[],
): readonly Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (antiPatterns.some((item) => item.name === "god class")) {
    suggestions.push(
      Object.freeze({
        title: "Split oversized classes",
        priority: "high",
        action: "Apply vertical slice extraction and isolate policies into dedicated services.",
      }),
    );
  }

  if (violations.some((item) => item.rule === "controller-to-db-direct-access")) {
    suggestions.push(
      Object.freeze({
        title: "Enforce service and repository layer",
        priority: "critical",
        action: "Move persistence calls from controllers into service and repository modules.",
      }),
    );
  }

  if (violations.some((item) => item.rule === "oversized-module")) {
    suggestions.push(
      Object.freeze({
        title: "Split modules by bounded context",
        priority: "medium",
        action: "Restructure folders into smaller context-oriented modules with explicit public APIs.",
      }),
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      Object.freeze({
        title: "Preserve current architecture",
        priority: "low",
        action: "No critical anti-patterns detected; maintain current module boundaries and monitor trends.",
      }),
    );
  }

  return Object.freeze(suggestions);
}
