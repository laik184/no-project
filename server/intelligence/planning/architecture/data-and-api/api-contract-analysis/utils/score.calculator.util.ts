import type { ApiContractIssue, ContractSeverity } from "../types.js";
import { CONTRACT_SCORE_START, CONTRACT_DEDUCTIONS } from "../types.js";

export function computeContractScore(
  issues: readonly ApiContractIssue[],
): number {
  let score = CONTRACT_SCORE_START;
  for (const issue of issues) {
    score -= CONTRACT_DEDUCTIONS[issue.severity] ?? 0;
  }
  return Math.max(0, score);
}

export function countBySeverity(
  issues:   readonly ApiContractIssue[],
  severity: ContractSeverity,
): number {
  return issues.filter((i) => i.severity === severity).length;
}

export function sortBySeverity(
  issues: readonly ApiContractIssue[],
): readonly ApiContractIssue[] {
  const order: Record<ContractSeverity, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  };
  return Object.freeze(
    [...issues].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)),
  );
}

export function issuesByType(
  issues: readonly ApiContractIssue[],
  type:   string,
): readonly ApiContractIssue[] {
  return Object.freeze(issues.filter((i) => i.type === type));
}

export function issuesByFile(
  issues:   readonly ApiContractIssue[],
  filePath: string,
): readonly ApiContractIssue[] {
  return Object.freeze(issues.filter((i) => i.filePath === filePath));
}

export function issuesByEndpoint(
  issues:   readonly ApiContractIssue[],
  endpoint: string,
): readonly ApiContractIssue[] {
  return Object.freeze(issues.filter((i) => i.endpoint === endpoint));
}

export function criticalIssues(
  issues: readonly ApiContractIssue[],
): readonly ApiContractIssue[] {
  return Object.freeze(issues.filter((i) => i.severity === "CRITICAL"));
}

export function totalDeductionWeight(issues: readonly ApiContractIssue[]): number {
  return issues.reduce((acc, i) => acc + (CONTRACT_DEDUCTIONS[i.severity] ?? 0), 0);
}
