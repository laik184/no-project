import type { CodeFile, ComplexityIssue, CognitiveResult } from "../types.js";
import { COGNITIVE_THRESHOLDS } from "../types.js";
import {
  extractFunctions,
  isTypeScriptOrJs,
  stripComments,
  stripStringLiterals,
} from "../utils/ast.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `cx-cog-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function computeCognitiveComplexity(body: string): number {
  const cleaned = stripComments(stripStringLiterals(body));
  const lines   = cleaned.split("\n");

  let score      = 0;
  let nesting    = 0;

  const nestingIncrement = [
    /^\s*(?:if|else\s+if|for|while|do|switch|catch)\b/,
  ];

  const nestingDecrement = [
    /^\s*\}/,
  ];

  const structuralAdd = [
    { re: /\bif\s*\(/,        weight: 1 },
    { re: /\belse\s+if\s*\(/, weight: 1 },
    { re: /\belse\b/,         weight: 1 },
    { re: /\bfor\s*[\s(]/,    weight: 1 },
    { re: /\bwhile\s*\(/,     weight: 1 },
    { re: /\bdo\s*\{/,        weight: 1 },
    { re: /\bswitch\s*\(/,    weight: 1 },
    { re: /\bcatch\s*\(/,     weight: 1 },
    { re: /\bbreak\s+\w/,     weight: 1 },
  ];

  const nonStructuralAdd = [
    { re: /&&/g,   weight: 1 },
    { re: /\|\|/g, weight: 1 },
    { re: /\?\?/g, weight: 1 },
    { re: /\?[^?:]/g, weight: 1 },
  ];

  const recursiveRe = /\bfunction\b|\b=>\s*\{/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    for (const { re, weight } of structuralAdd) {
      if (re.test(trimmed)) {
        score += weight + nesting;
      }
    }

    for (const { re, weight } of nonStructuralAdd) {
      const fresh = new RegExp(re.source, "g");
      const m = trimmed.match(fresh);
      if (m) score += m.length * weight;
    }

    if (recursiveRe.test(trimmed) && !trimmed.includes("function ") && !trimmed.startsWith("function")) {
      score += 1;
    }

    if (nestingIncrement.some((r) => r.test(trimmed))) {
      nesting++;
    }
    if (nestingDecrement.some((r) => r.test(trimmed))) {
      nesting = Math.max(0, nesting - 1);
    }
  }

  return score;
}

function classifyScore(value: number): {
  severity: ComplexityIssue["severity"];
  type:     ComplexityIssue["type"];
} | null {
  if (value >= COGNITIVE_THRESHOLDS.CRITICAL) {
    return { severity: "CRITICAL", type: "EXTREME_COGNITIVE_COMPLEXITY" };
  }
  if (value >= COGNITIVE_THRESHOLDS.HIGH) {
    return { severity: "HIGH",     type: "HIGH_COGNITIVE_COMPLEXITY" };
  }
  if (value >= COGNITIVE_THRESHOLDS.MEDIUM) {
    return { severity: "MEDIUM",   type: "HIGH_COGNITIVE_COMPLEXITY" };
  }
  return null;
}

export function scoreCognitiveComplexity(
  files: readonly CodeFile[],
): CognitiveResult {
  const allIssues: ComplexityIssue[] = [];
  let totalScore  = 0;
  let funcCount   = 0;
  let maxScore    = 0;

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;

    const functions = extractFunctions(file.content);

    for (const fn of functions) {
      const cs = computeCognitiveComplexity(fn.body);
      totalScore += cs;
      funcCount++;
      maxScore = Math.max(maxScore, cs);

      const classification = classifyScore(cs);
      if (!classification) continue;

      const threshold =
        cs >= COGNITIVE_THRESHOLDS.CRITICAL ? COGNITIVE_THRESHOLDS.CRITICAL :
        cs >= COGNITIVE_THRESHOLDS.HIGH     ? COGNITIVE_THRESHOLDS.HIGH     :
                                              COGNITIVE_THRESHOLDS.MEDIUM;

      allIssues.push(
        Object.freeze<ComplexityIssue>({
          id:           nextId(),
          type:         classification.type,
          severity:     classification.severity,
          filePath:     file.path,
          functionName: fn.name,
          line:         fn.startLine,
          column:       null,
          metricValue:  cs,
          threshold,
          message:      `"${fn.name}" has a cognitive complexity of ${cs} (threshold: ${threshold}). The control flow nesting and branching makes it disproportionately hard for humans to read and understand.`,
          rule:         "CX-COG-001",
          suggestion:   `Reduce nesting in "${fn.name}" with early returns (guard clauses), extract complex conditions into named boolean variables, and split compound logic into smaller named helpers.`,
          snippet:      file.content.split("\n")[fn.startLine - 1]?.trim().slice(0, 120) ?? null,
        }),
      );
    }
  }

  const avgCognitive = funcCount > 0
    ? Math.round((totalScore / funcCount) * 10) / 10
    : 0;

  return Object.freeze({
    issues:       Object.freeze(allIssues.slice(0, 100)),
    filesScanned: files.filter((f) => isTypeScriptOrJs(f)).length,
    avgCognitive,
    maxCognitive: maxScore,
  });
}
