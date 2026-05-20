import { ValidationInput, ValidationIssue } from "../types";

const REQUIRED_RESULT_FIELDS = ["success", "logs"] as const;

const SOURCE_CONTRACTS: Record<string, readonly string[]> = {
  generation:   ["success", "logs"],
  execution:    ["success", "logs"],
  intelligence: ["success", "logs"],
};

export function validateContract(input: ValidationInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const requiredFields = SOURCE_CONTRACTS[input.source] ?? REQUIRED_RESULT_FIELDS;

  for (const field of requiredFields) {
    const pattern = new RegExp(`["']?${field}["']?\\s*:`, "i");
    if (!pattern.test(input.code)) {
      issues.push(Object.freeze({
        type: "contract" as const,
        severity: "high" as const,
        message: `Required output field "${field}" not found in output contract.`,
        rule: `missing-field-${field}`,
      }));
    }
  }

  if (input.metadata) {
    const requiredMeta = ["agentId", "timestamp"];
    for (const key of requiredMeta) {
      if (!(key in input.metadata)) {
        issues.push(Object.freeze({
          type: "contract" as const,
          severity: "medium" as const,
          message: `Metadata missing required key: "${key}".`,
          rule: `missing-metadata-${key}`,
        }));
      }
    }
  }

  if (!input.source || input.source === "unknown") {
    issues.push(Object.freeze({
      type: "contract" as const,
      severity: "medium" as const,
      message: `Output source is unspecified or unknown — cannot enforce strict contract.`,
      rule: "unknown-source",
    }));
  }

  return Object.freeze(issues);
}
