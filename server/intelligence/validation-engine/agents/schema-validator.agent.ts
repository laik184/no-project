import { ValidationInput, ValidationIssue } from "../types";

type SchemaShape = Record<string, { type: string; required?: boolean }>;

export function validateSchema(input: ValidationInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.schema || Object.keys(input.schema).length === 0) {
    return Object.freeze([]);
  }

  const schema = input.schema as SchemaShape;

  for (const [field, rules] of Object.entries(schema)) {
    const fieldPattern = new RegExp(`["']?${field}["']?\\s*:`, "i");

    if (rules.required && !fieldPattern.test(input.code)) {
      issues.push(Object.freeze({
        type: "schema" as const,
        severity: "high" as const,
        message: `Required schema field "${field}" (type: ${rules.type}) is absent from the output.`,
        rule: `schema-required-${field}`,
      }));
      continue;
    }

    if (fieldPattern.test(input.code)) {
      const typeCheck = buildTypePattern(field, rules.type);
      if (typeCheck && !typeCheck.test(input.code)) {
        issues.push(Object.freeze({
          type: "schema" as const,
          severity: "medium" as const,
          message: `Field "${field}" appears to have an incorrect type — expected ${rules.type}.`,
          rule: `schema-type-mismatch-${field}`,
        }));
      }
    }
  }

  return Object.freeze(issues);
}

function buildTypePattern(field: string, type: string): RegExp | null {
  const base = `["']?${field}["']?\\s*:\\s*`;
  switch (type) {
    case "string":  return new RegExp(base + `["'\`]`, "i");
    case "number":  return new RegExp(base + `\\d`, "i");
    case "boolean": return new RegExp(base + `(true|false)`, "i");
    case "array":   return new RegExp(base + `\\[`, "i");
    case "object":  return new RegExp(base + `\\{`, "i");
    default:        return null;
  }
}
