import type { AnalysisViolation } from "../types.js";
import type { UrgencyAssessment } from "./priority.types.js";

const DEPLOYMENT_BLOCKERS = Object.freeze([
  "STATE_MUTATION_OUTSIDE_ORCHESTRATOR",
  "CIRCULAR_DEPENDENCY",
  "UPWARD_IMPORT",
  "ORCHESTRATOR_BYPASS",
]);

export function detectUrgency(
  violation: Readonly<AnalysisViolation>,
  priorityScore: number,
): Readonly<UrgencyAssessment> {
  const blocksDeployment = violation.severity === "CRITICAL"
    || DEPLOYMENT_BLOCKERS.includes(violation.type);

  const urgent = blocksDeployment || priorityScore >= 85;

  const reason = blocksDeployment
    ? "Violation can block deployment or break runtime safety."
    : urgent
      ? "Priority score exceeds urgent threshold."
      : "Can be handled in regular remediation cycle.";

  return Object.freeze({ urgent, blocksDeployment, reason });
}
