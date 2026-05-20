import type {
  ExecutionStrategy,
  PlanValidationReport,
  RiskAssessment,
  ValidationIssue,
} from "../types.ts";

export function validatePlan(
  strategy: Readonly<ExecutionStrategy>,
  riskAssessment: Readonly<RiskAssessment>,
): Readonly<PlanValidationReport> {
  const issues: ValidationIssue[] = [];

  if (strategy.totalTasks === 0) {
    issues.push({ type: "ERROR", message: "Execution strategy has zero tasks" });
  }

  if (strategy.units.length === 0) {
    issues.push({ type: "ERROR", message: "No execution units found in strategy" });
  }

  if (strategy.estimatedDuration < 0) {
    issues.push({ type: "ERROR", message: "Estimated duration is negative — strategy is malformed" });
  }

  for (const blocking of riskAssessment.blockingIssues) {
    issues.push({ type: "ERROR", message: `Blocking risk: ${blocking}` });
  }

  for (const warning of riskAssessment.warnings) {
    issues.push({ type: "WARNING", message: warning });
  }

  const errors = issues.filter((i) => i.type === "ERROR");
  const warnings = issues.filter((i) => i.type === "WARNING");

  const errorPenalty = errors.length * 30;
  const warnPenalty = warnings.length * 5;
  const score = Math.max(0, Math.min(100, 100 - errorPenalty - warnPenalty));

  const valid = errors.length === 0;

  const summary = valid
    ? `Plan is valid: score=${score}/100 with ${warnings.length} warning(s)`
    : `Plan is invalid: ${errors.length} error(s) found — ${errors.map((e) => e.message).join("; ")}`;

  return Object.freeze({
    valid,
    issues: Object.freeze(issues),
    score,
    summary,
  });
}
