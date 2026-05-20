import type { CodeFile, ComplexityIssue, CyclomaticResult } from "../types.js";
import {
  CYCLOMATIC_DECISION_PATTERNS,
  CYCLOMATIC_THRESHOLDS,
} from "../types.js";
import {
  extractFunctions,
  isTypeScriptOrJs,
  stripComments,
  stripStringLiterals,
  countPatternInContent,
} from "../utils/ast.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `cx-cyclo-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function computeCyclomaticComplexity(body: string): number {
  const cleaned = stripComments(stripStringLiterals(body));
  return 1 + countPatternInContent(cleaned, CYCLOMATIC_DECISION_PATTERNS);
}

function classifyComplexity(value: number): {
  severity: ComplexityIssue["severity"];
  type:     ComplexityIssue["type"];
} | null {
  if (value >= CYCLOMATIC_THRESHOLDS.CRITICAL) {
    return { severity: "CRITICAL", type: "EXTREME_CYCLOMATIC_COMPLEXITY" };
  }
  if (value >= CYCLOMATIC_THRESHOLDS.HIGH) {
    return { severity: "HIGH",     type: "HIGH_CYCLOMATIC_COMPLEXITY" };
  }
  if (value >= CYCLOMATIC_THRESHOLDS.MEDIUM) {
    return { severity: "MEDIUM",   type: "HIGH_CYCLOMATIC_COMPLEXITY" };
  }
  return null;
}

export function scoreCyclomaticComplexity(
  files: readonly CodeFile[],
): CyclomaticResult {
  const allIssues: ComplexityIssue[] = [];
  let totalComplexity = 0;
  let funcCount       = 0;
  let maxComplexity   = 0;

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;

    const functions = extractFunctions(file.content);

    for (const fn of functions) {
      const cc = computeCyclomaticComplexity(fn.body);
      totalComplexity += cc;
      funcCount++;
      maxComplexity = Math.max(maxComplexity, cc);

      const classification = classifyComplexity(cc);
      if (!classification) continue;

      const threshold =
        cc >= CYCLOMATIC_THRESHOLDS.CRITICAL ? CYCLOMATIC_THRESHOLDS.CRITICAL :
        cc >= CYCLOMATIC_THRESHOLDS.HIGH     ? CYCLOMATIC_THRESHOLDS.HIGH     :
                                               CYCLOMATIC_THRESHOLDS.MEDIUM;

      allIssues.push(
        Object.freeze<ComplexityIssue>({
          id:           nextId(),
          type:         classification.type,
          severity:     classification.severity,
          filePath:     file.path,
          functionName: fn.name,
          line:         fn.startLine,
          column:       null,
          metricValue:  cc,
          threshold,
          message:      `"${fn.name}" has a cyclomatic complexity of ${cc} (threshold: ${threshold}). It has ${cc - 1} independent execution paths — far too many to reason about or test reliably.`,
          rule:         "CX-CYCLO-001",
          suggestion:   `Decompose "${fn.name}" into smaller, single-purpose functions. Extract each conditional branch into a named helper. Aim for complexity ≤ 10 per function.`,
          snippet:      file.content.split("\n")[fn.startLine - 1]?.trim().slice(0, 120) ?? null,
        }),
      );
    }
  }

  const avgComplexity = funcCount > 0
    ? Math.round((totalComplexity / funcCount) * 10) / 10
    : 0;

  return Object.freeze({
    issues:         Object.freeze(allIssues.slice(0, 100)),
    filesScanned:   files.filter((f) => isTypeScriptOrJs(f)).length,
    avgComplexity,
    maxComplexity,
  });
}
