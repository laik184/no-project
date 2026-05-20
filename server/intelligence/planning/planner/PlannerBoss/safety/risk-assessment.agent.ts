import type {
  ExecutionStrategy,
  RiskAssessment,
  RiskFactor,
  RiskLevel,
} from "../types.ts";

const HIGH_TASK_COUNT_THRESHOLD = 20;
const HIGH_PARALLEL_GROUP_THRESHOLD = 8;
const HIGH_DURATION_THRESHOLD_MS = 300_000;

function makeRiskFactor(
  category: string,
  description: string,
  level: RiskLevel,
  mitigation: string,
): Readonly<RiskFactor> {
  return Object.freeze({ category, description, level, mitigation });
}

export function assessRisk(strategy: Readonly<ExecutionStrategy>): Readonly<RiskAssessment> {
  const factors: RiskFactor[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (strategy.totalTasks > HIGH_TASK_COUNT_THRESHOLD) {
    factors.push(makeRiskFactor(
      "SCALE",
      `High task count: ${strategy.totalTasks} tasks may increase failure surface`,
      "MEDIUM",
      "Consider splitting into sub-plans with fewer tasks each",
    ));
    warnings.push(`Plan has ${strategy.totalTasks} tasks — consider chunking into sub-plans`);
  }

  if (strategy.parallelGroups > HIGH_PARALLEL_GROUP_THRESHOLD) {
    factors.push(makeRiskFactor(
      "CONCURRENCY",
      `High parallelism: ${strategy.parallelGroups} parallel groups may cause resource contention`,
      "MEDIUM",
      "Verify resource limits and consider reducing max concurrency",
    ));
    warnings.push(`${strategy.parallelGroups} parallel execution groups — verify resource limits`);
  }

  if (strategy.estimatedDuration > HIGH_DURATION_THRESHOLD_MS) {
    factors.push(makeRiskFactor(
      "DURATION",
      `Long estimated duration: ${Math.round(strategy.estimatedDuration / 1000)}s exceeds safe threshold`,
      "HIGH",
      "Add timeout guards and checkpoint-based retry logic",
    ));
    warnings.push(`Estimated plan duration is ${Math.round(strategy.estimatedDuration / 1000)}s — consider timeout guards`);
  }

  if (strategy.totalTasks === 0) {
    blockingIssues.push("Execution strategy contains zero tasks — plan cannot proceed");
  }

  if (strategy.units.length === 0) {
    blockingIssues.push("Execution strategy contains zero execution units");
  }

  const overallRisk: RiskLevel =
    blockingIssues.length > 0
      ? "CRITICAL"
      : factors.some((f) => f.level === "HIGH")
      ? "HIGH"
      : factors.length >= 1
      ? "MEDIUM"
      : "LOW";

  const approved = blockingIssues.length === 0 && overallRisk !== "CRITICAL";

  return Object.freeze({
    overallRisk,
    factors: Object.freeze(factors),
    blockingIssues: Object.freeze(blockingIssues),
    warnings: Object.freeze(warnings),
    approved,
  });
}
