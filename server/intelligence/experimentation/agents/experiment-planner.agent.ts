import type { ExperimentInput, ExperimentPlan } from "../types";
import { normalizeGoalText, normalizeContextText, normalizeHints } from "../utils/normalization.util";

export interface ExperimentPlannerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  plan?: ExperimentPlan;
}

function inferTestType(goal: string, hints: string[]): ExperimentPlan["testType"] {
  const combined = (goal + " " + hints.join(" ")).toLowerCase();
  if (combined.includes("a/b") || combined.includes("a-b") || combined.includes("compare two")) return "a-b";
  if (combined.includes("multivariate") || combined.includes("multi") || combined.includes("many")) return "multivariate";
  return "exploration";
}

function inferStrategyCount(testType: ExperimentPlan["testType"], hints: string[]): number {
  if (testType === "a-b") return 2;
  if (testType === "multivariate") return Math.min(5, Math.max(3, hints.length + 2));
  return 3;
}

function extractConstraints(context: string, hints: string[]): string[] {
  const constraints: string[] = [];
  const lower = context.toLowerCase();
  if (lower.includes("latency") || lower.includes("fast") || lower.includes("speed")) {
    constraints.push("Minimize latency");
  }
  if (lower.includes("accuracy") || lower.includes("precise") || lower.includes("correct")) {
    constraints.push("Maximize accuracy");
  }
  if (lower.includes("safe") || lower.includes("risk") || lower.includes("reliable")) {
    constraints.push("Minimize risk");
  }
  if (hints.length > 0) {
    constraints.push(`Strategy hints: ${hints.join(", ")}`);
  }
  if (constraints.length === 0) {
    constraints.push("Balance speed, accuracy, and reliability");
  }
  return constraints;
}

export function planExperiment(input: ExperimentInput): ExperimentPlannerOutput {
  const logs: string[] = [];
  try {
    const goal = normalizeGoalText(input.goal);
    const context = normalizeContextText(input.context);
    const hints = normalizeHints(input.strategyHints);

    logs.push(`[experiment-planner] goal="${goal.slice(0, 60)}" hints=${hints.length}`);

    const testType = inferTestType(goal, hints);
    const strategyCount = inferStrategyCount(testType, hints);
    const constraints = extractConstraints(context, hints);

    logs.push(`[experiment-planner] testType=${testType} strategyCount=${strategyCount} constraints=${constraints.length}`);

    const plan: ExperimentPlan = { goal, testType, strategyCount, constraints };
    return { success: true, logs, plan };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[experiment-planner] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
