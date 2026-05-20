import type { CodeFile, ComplexityIssue, FunctionLengthResult } from "../types.js";
import {
  FUNCTION_LENGTH_THRESHOLDS,
  FILE_LENGTH_THRESHOLDS,
} from "../types.js";
import {
  extractFunctions,
  isTypeScriptOrJs,
  countNonEmptyLines,
} from "../utils/ast.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `cx-len-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function classifyLength(lineCount: number): {
  severity: ComplexityIssue["severity"];
  type:     ComplexityIssue["type"];
  threshold: number;
} | null {
  if (lineCount > FUNCTION_LENGTH_THRESHOLDS.CRITICAL) {
    return { severity: "CRITICAL", type: "EXTREMELY_LONG_FUNCTION", threshold: FUNCTION_LENGTH_THRESHOLDS.CRITICAL };
  }
  if (lineCount > FUNCTION_LENGTH_THRESHOLDS.HIGH) {
    return { severity: "HIGH",     type: "LONG_FUNCTION",           threshold: FUNCTION_LENGTH_THRESHOLDS.HIGH };
  }
  if (lineCount > FUNCTION_LENGTH_THRESHOLDS.MEDIUM) {
    return { severity: "MEDIUM",   type: "LONG_FUNCTION",           threshold: FUNCTION_LENGTH_THRESHOLDS.MEDIUM };
  }
  return null;
}

function analyzeFunctionLengths(file: CodeFile): readonly ComplexityIssue[] {
  const functions  = extractFunctions(file.content);
  const issues: ComplexityIssue[] = [];

  for (const fn of functions) {
    const nonEmptyLines = countNonEmptyLines(fn.body);
    const classification = classifyLength(nonEmptyLines);
    if (!classification) continue;

    issues.push(
      Object.freeze<ComplexityIssue>({
        id:           nextId(),
        type:         classification.type,
        severity:     classification.severity,
        filePath:     file.path,
        functionName: fn.name,
        line:         fn.startLine,
        column:       null,
        metricValue:  nonEmptyLines,
        threshold:    classification.threshold,
        message:      `"${fn.name}" is ${nonEmptyLines} non-empty lines long (threshold: ${classification.threshold}). Functions this long are difficult to test, review, and understand in isolation.`,
        rule:         "CX-LEN-001",
        suggestion:   `Break "${fn.name}" into smaller, single-responsibility functions. Extract logical sub-steps into named helpers. A function should do one thing and fit on one screen (~30 lines).`,
        snippet:      file.content.split("\n")[fn.startLine - 1]?.trim().slice(0, 120) ?? null,
      }),
    );
  }

  return Object.freeze(issues);
}

function analyzeFileLength(file: CodeFile): readonly ComplexityIssue[] {
  const totalLines = countNonEmptyLines(file.content);

  if (totalLines <= FILE_LENGTH_THRESHOLDS.LOW) return Object.freeze([]);

  const severity:   ComplexityIssue["severity"] = totalLines > FILE_LENGTH_THRESHOLDS.MEDIUM ? "MEDIUM" : "LOW";
  const threshold = totalLines > FILE_LENGTH_THRESHOLDS.MEDIUM
    ? FILE_LENGTH_THRESHOLDS.MEDIUM
    : FILE_LENGTH_THRESHOLDS.LOW;

  return Object.freeze([
    Object.freeze<ComplexityIssue>({
      id:           nextId(),
      type:         "LONG_FILE",
      severity,
      filePath:     file.path,
      functionName: null,
      line:         null,
      column:       null,
      metricValue:  totalLines,
      threshold,
      message:      `File has ${totalLines} non-empty lines (threshold: ${threshold}). Large files accumulate too many responsibilities and become hard to navigate.`,
      rule:         "CX-LEN-002",
      suggestion:   "Split this file by responsibility. Extract distinct concerns into separate modules (e.g., separate utils, types, and business logic). Each file should have a single, clearly named purpose.",
      snippet:      null,
    }),
  ]);
}

export function analyzeFunctionLength(
  files: readonly CodeFile[],
): FunctionLengthResult {
  const allIssues: ComplexityIssue[] = [];
  let totalFuncLines = 0;
  let funcCount      = 0;
  let longFuncCount  = 0;

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;

    const funcIssues = analyzeFunctionLengths(file);
    const fileIssues = analyzeFileLength(file);

    longFuncCount += funcIssues.length;

    for (const issue of funcIssues) {
      totalFuncLines += issue.metricValue;
      funcCount++;
    }

    allIssues.push(...funcIssues, ...fileIssues);
  }

  const avgFuncLength = funcCount > 0
    ? Math.round((totalFuncLines / funcCount) * 10) / 10
    : 0;

  return Object.freeze({
    issues:         Object.freeze(allIssues.slice(0, 100)),
    filesScanned:   files.filter((f) => isTypeScriptOrJs(f)).length,
    longFuncCount,
    avgFuncLength,
  });
}
