import type { CodeFile, ComplexityIssue, NestingDepthResult } from "../types.js";
import {
  NESTING_THRESHOLDS,
  CALLBACK_NEST_PATTERNS,
} from "../types.js";
import {
  isTypeScriptOrJs,
  stripComments,
  stripStringLiterals,
  countPatternInContent,
} from "../utils/ast.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `cx-nest-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

interface DepthSample {
  readonly depth:   number;
  readonly line:    number;
  readonly snippet: string;
}

function measureNestingDepth(content: string): {
  maxDepth:   number;
  deepSample: DepthSample | null;
} {
  const cleaned = stripComments(stripStringLiterals(content));
  const lines   = cleaned.split("\n");

  let depth     = 0;
  let maxDepth  = 0;
  let deepLine  = -1;
  let deepSnippet = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const raw  = content.split("\n")[i] ?? "";

    for (const ch of line) {
      if (ch === "{") {
        depth++;
        if (depth > maxDepth) {
          maxDepth    = depth;
          deepLine    = i + 1;
          deepSnippet = raw.trim().slice(0, 120);
        }
      }
      if (ch === "}") {
        depth = Math.max(0, depth - 1);
      }
    }
  }

  return {
    maxDepth,
    deepSample: maxDepth > 0 ? Object.freeze({ depth: maxDepth, line: deepLine, snippet: deepSnippet }) : null,
  };
}

function measureFunctionNesting(
  content: string,
  filePath: string,
): readonly ComplexityIssue[] {
  const cleaned   = stripComments(stripStringLiterals(content));
  const lines     = cleaned.split("\n");
  const rawLines  = content.split("\n");
  const issues: ComplexityIssue[] = [];

  const controlFlowRe = /\b(?:if|else|for|while|do|switch|catch|try)\b/;
  let   controlDepth  = 0;
  let   braceDepth    = 0;
  let   maxControl    = 0;
  let   deepLine      = -1;
  let   deepSnippet   = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const raw  = rawLines[i] ?? "";

    if (controlFlowRe.test(line)) {
      controlDepth++;
      if (controlDepth > maxControl) {
        maxControl  = controlDepth;
        deepLine    = i + 1;
        deepSnippet = raw.trim().slice(0, 120);
      }
    }

    for (const ch of line) {
      if (ch === "{") braceDepth++;
      if (ch === "}") {
        braceDepth   = Math.max(0, braceDepth - 1);
        controlDepth = Math.max(0, controlDepth - 1);
      }
    }
  }

  if (maxControl < NESTING_THRESHOLDS.MEDIUM) return Object.freeze([]);

  const severity: ComplexityIssue["severity"] =
    maxControl >= NESTING_THRESHOLDS.CRITICAL ? "CRITICAL" :
    maxControl >= NESTING_THRESHOLDS.HIGH     ? "HIGH"     :
                                                "MEDIUM";

  const threshold =
    maxControl >= NESTING_THRESHOLDS.CRITICAL ? NESTING_THRESHOLDS.CRITICAL :
    maxControl >= NESTING_THRESHOLDS.HIGH     ? NESTING_THRESHOLDS.HIGH     :
                                                NESTING_THRESHOLDS.MEDIUM;

  issues.push(
    Object.freeze<ComplexityIssue>({
      id:           nextId(),
      type:         severity === "CRITICAL" ? "EXTREME_NESTING" : "DEEP_NESTING",
      severity,
      filePath,
      functionName: null,
      line:         deepLine >= 0 ? deepLine : null,
      column:       null,
      metricValue:  maxControl,
      threshold,
      message:      `Maximum control-flow nesting depth of ${maxControl} detected (threshold: ${threshold}). Deep nesting is the primary driver of unreadable, hard-to-test code.`,
      rule:         "CX-NEST-001",
      suggestion:   "Flatten nesting with early returns (guard clauses): check the failure condition first and return, keeping the happy path at the top level. Extract deeply nested blocks into named helper functions.",
      snippet:      deepSnippet || null,
    }),
  );

  return Object.freeze(issues);
}

function detectCallbackHell(
  file: CodeFile,
): readonly ComplexityIssue[] {
  const count = countPatternInContent(file.content, CALLBACK_NEST_PATTERNS);
  if (count < 3) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<ComplexityIssue>({
      id:           nextId(),
      type:         "CALLBACK_HELL",
      severity:     "HIGH",
      filePath:     file.path,
      functionName: null,
      line:         null,
      column:       null,
      metricValue:  count,
      threshold:    3,
      message:      `${count} nested callback/then patterns detected. Callback pyramids make control flow nearly impossible to follow and error handling unreliable.`,
      rule:         "CX-NEST-002",
      suggestion:   "Convert nested .then() chains to async/await. Replace callback-style APIs with their Promise equivalents. Use util.promisify() for Node.js callback APIs.",
      snippet:      null,
    }),
  ]);
}

export function analyzeNestingDepth(
  files: readonly CodeFile[],
): NestingDepthResult {
  const allIssues: ComplexityIssue[] = [];
  let maxDepthOverall = 0;
  let deepNestCount   = 0;

  for (const file of files) {
    if (!isTypeScriptOrJs(file)) continue;

    const { maxDepth } = measureNestingDepth(file.content);
    maxDepthOverall = Math.max(maxDepthOverall, maxDepth);

    const nestIssues     = measureFunctionNesting(file.content, file.path);
    const callbackIssues = detectCallbackHell(file);

    deepNestCount += nestIssues.length;

    allIssues.push(...nestIssues, ...callbackIssues);
  }

  return Object.freeze({
    issues:       Object.freeze(allIssues.slice(0, 80)),
    filesScanned: files.filter((f) => isTypeScriptOrJs(f)).length,
    maxDepth:     maxDepthOverall,
    deepNestCount,
  });
}
