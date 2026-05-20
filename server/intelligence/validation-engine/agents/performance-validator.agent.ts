import { ValidationInput, ValidationIssue } from "../types";

interface PerfRule {
  readonly pattern: RegExp;
  readonly rule: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly message: string;
}

const PERF_RULES: readonly PerfRule[] = Object.freeze([
  {
    pattern: /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)\s*\{[^}]*for\s*\(/g,
    rule: "triple-nested-loop",
    severity: "high",
    message: "Triple-nested loop detected — O(n³) complexity risk.",
  },
  {
    pattern: /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)/g,
    rule: "nested-loop",
    severity: "medium",
    message: "Nested loop detected — verify O(n²) complexity is acceptable.",
  },
  {
    pattern: /\.(forEach|map|filter|reduce)\s*\([^)]*\.(forEach|map|filter|reduce)\s*\(/g,
    rule: "chained-array-iteration",
    severity: "medium",
    message: "Chained array iterations — consider combining into a single pass.",
  },
  {
    pattern: /JSON\.parse\s*\(\s*JSON\.stringify/g,
    rule: "json-deep-clone",
    severity: "medium",
    message: "JSON.parse(JSON.stringify()) used for deep clone — use structuredClone() instead.",
  },
  {
    pattern: /setInterval\s*\([^,]+,\s*[0-9]+\s*\)/g,
    rule: "setinterval-usage",
    severity: "low",
    message: "setInterval() detected — verify it is cleared on cleanup to prevent memory leaks.",
  },
  {
    pattern: /new\s+Array\s*\(\s*\d{6,}\s*\)/g,
    rule: "large-array-allocation",
    severity: "high",
    message: "Large static array allocation detected — may cause memory pressure.",
  },
  {
    pattern: /await\s+Promise\.all\s*\(\s*\[[\s\S]*?\.map\(/g,
    rule: "promise-all-map-ok",
    severity: "low",
    message: "Promise.all with map detected — ensure error handling covers partial failures.",
  },
  {
    pattern: /while\s*\(.*length.*>\s*0\s*\)/g,
    rule: "while-length-drain",
    severity: "low",
    message: "while(arr.length > 0) pattern — verify this terminates correctly.",
  },
  {
    pattern: /document\.querySelector(All)?\s*\([^)]+\)/g,
    rule: "dom-query-in-loop",
    severity: "medium",
    message: "DOM query detected — ensure it is not called inside a loop.",
  },
]);

export function validatePerformance(input: ValidationInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of PERF_RULES) {
    const matches = input.code.match(rule.pattern);
    if (matches) {
      issues.push(Object.freeze({
        type: "performance" as const,
        severity: rule.severity,
        message: `${rule.message} (${matches.length} instance${matches.length > 1 ? "s" : ""})`,
        rule: rule.rule,
      }));
    }
  }

  const codeSize = Buffer.byteLength(input.code, "utf8");
  if (codeSize > 100_000) {
    issues.push(Object.freeze({
      type: "performance" as const,
      severity: "medium" as const,
      message: `Output is ${Math.round(codeSize / 1024)}KB — consider splitting into smaller modules.`,
      rule: "large-output-size",
    }));
  }

  return Object.freeze(issues);
}
