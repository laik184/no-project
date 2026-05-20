import { ValidationInput, ValidationIssue } from "../types";

interface LogicRule {
  readonly pattern: RegExp;
  readonly rule: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly message: string;
}

const LOGIC_RULES: readonly LogicRule[] = Object.freeze([
  {
    pattern: /if\s*\(.*===\s*(true|false)\)/g,
    rule: "explicit-boolean-compare",
    severity: "low",
    message: "Explicit boolean comparison with === true/false — use the value directly.",
  },
  {
    pattern: /\breturn\b[^;{]*\n[^;]*\breturn\b/g,
    rule: "dead-code-after-return",
    severity: "medium",
    message: "Code after a return statement detected — unreachable code.",
  },
  {
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    rule: "empty-catch",
    severity: "high",
    message: "Empty catch block silently swallows errors.",
  },
  {
    pattern: /==\s*(null|undefined)/g,
    rule: "loose-null-check",
    severity: "medium",
    message: "Loose null/undefined check with == — use === null or nullish coalescing.",
  },
  {
    pattern: /while\s*\(\s*true\s*\)/g,
    rule: "infinite-loop-risk",
    severity: "high",
    message: "while(true) detected — verify break condition exists.",
  },
  {
    pattern: /\.then\s*\(.*\)\.catch\s*\(\s*\)/g,
    rule: "empty-promise-catch",
    severity: "high",
    message: "Promise .catch() with empty handler — errors will be silently lost.",
  },
  {
    pattern: /async\s+function[^(]*\([^)]*\)\s*\{[^}]*(?<!await)[^}]*\}/g,
    rule: "async-no-await",
    severity: "medium",
    message: "Async function without any await expression — may be unnecessarily async.",
  },
  {
    pattern: /\beval\s*\(/g,
    rule: "eval-usage",
    severity: "critical",
    message: "eval() usage detected — dangerous and should never be used.",
  },
]);

export function validateLogic(input: ValidationInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of LOGIC_RULES) {
    const matches = input.code.match(rule.pattern);
    if (matches) {
      issues.push(Object.freeze({
        type: "logic" as const,
        severity: rule.severity,
        message: `${rule.message} (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`,
        rule: rule.rule,
      }));
    }
  }

  const functionCount = (input.code.match(/\bfunction\b|\=>/g) ?? []).length;
  const returnCount   = (input.code.match(/\breturn\b/g) ?? []).length;
  if (functionCount > 0 && returnCount === 0 && input.source === "generation") {
    issues.push(Object.freeze({
      type: "logic" as const,
      severity: "medium" as const,
      message: "Generated code contains functions but no return statements — likely incomplete.",
      rule: "no-return-in-functions",
    }));
  }

  return Object.freeze(issues);
}
