import type { EvaluationResult, Feedback, Issue, IssueCode } from '../types.ts';

const INSTRUCTION_MAP: Record<IssueCode, (issue: Issue) => string> = {
  EMPTY_RESULT: () => 'Re-run the agent and ensure it produces non-empty output before returning.',
  INCOMPLETE_OUTPUT: (i) =>
    `Complete the output by populating missing field(s): ${i.field ?? 'unknown'}. Verify the generation template covers all required fields.`,
  CONTRACT_VIOLATION: (i) =>
    `Fix type mismatch on field "${i.field ?? 'unknown'}". Ensure output matches the declared contract type.`,
  SCHEMA_MISMATCH: (i) =>
    `Schema validation failed on "${i.field ?? 'unknown'}". Align the output structure with the expected schema.`,
  LOGICAL_ERROR: (i) =>
    `A logical error was detected: "${i.message}". Inspect the agent logic and fix the root cause.`,
  TIMEOUT: (i) =>
    `Execution exceeded time limit. ${i.message}. Optimize the agent or increase the timeout threshold.`,
  UNKNOWN: (i) =>
    `Unclassified issue detected: "${i.message}". Review the agent output manually.`,
};

function priorityFromSeverity(severity: Issue['severity']): number {
  const map: Record<Issue['severity'], number> = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
  };
  return map[severity] ?? 25;
}

function targetFromCode(code: IssueCode): string {
  const map: Record<IssueCode, string> = {
    EMPTY_RESULT: 'output-generator',
    INCOMPLETE_OUTPUT: 'output-generator',
    CONTRACT_VIOLATION: 'output-validator',
    SCHEMA_MISMATCH: 'output-validator',
    LOGICAL_ERROR: 'core-agent',
    TIMEOUT: 'execution-engine',
    UNKNOWN: 'core-agent',
  };
  return map[code] ?? 'core-agent';
}

export function generateFeedback(evaluation: EvaluationResult): Feedback[] {
  const feedbacks: Feedback[] = evaluation.issues.map((issue) => {
    const instructionFn = INSTRUCTION_MAP[issue.code] ?? INSTRUCTION_MAP['UNKNOWN'];
    return Object.freeze({
      issueRef: issue.code,
      instruction: instructionFn(issue),
      priority: priorityFromSeverity(issue.severity),
      target: targetFromCode(issue.code),
    });
  });

  return feedbacks.sort((a, b) => b.priority - a.priority);
}
