import type { CodeFile, TestArchIssue, RatioAnalysisResult } from "../types.js";
import {
  MIN_TEST_TO_CODE_RATIO,
  LOW_RATIO_THRESHOLD,
  UNIT_TEST_PATTERNS,
  ASSERTION_PATTERNS,
} from "../types.js";
import {
  hasAnyPattern,
  countPatternMatches,
  isTestFile,
  isSourceFile,
  countNonEmptyLines,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `test-ratio-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function checkTestToCodeRatio(
  sourceLines:  number,
  testLines:    number,
  sourceFiles:  readonly CodeFile[],
): readonly TestArchIssue[] {
  if (sourceLines === 0 || testLines === 0) return Object.freeze([]);

  const ratio = testLines / sourceLines;
  if (ratio >= MIN_TEST_TO_CODE_RATIO) return Object.freeze([]);

  const severity = ratio < LOW_RATIO_THRESHOLD ? "HIGH" : "MEDIUM";
  const pct      = Math.round(ratio * 100);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "LOW_TEST_TO_CODE_RATIO",
      severity,
      filePath:   sourceFiles[0]?.path ?? "unknown",
      line:       null,
      column:     null,
      message:    `Test-to-code ratio is ${pct}% (${testLines} test lines / ${sourceLines} source lines). Recommended minimum is ${Math.round(MIN_TEST_TO_CODE_RATIO * 100)}%. Low ratio indicates significant untested surface area.`,
      rule:       "TEST-RATIO-001",
      suggestion: `Increase test coverage by adding tests for the modules with no corresponding test file. Target at least 1 line of test code per 3 lines of source code (33% ratio) as a baseline.`,
      snippet:    null,
    }),
  ]);
}

function checkUntestedModule(
  file:      CodeFile,
  allFiles:  readonly CodeFile[],
): readonly TestArchIssue[] {
  if (!isSourceFile(file)) return Object.freeze([]);

  const baseName = (file.path.split("/").pop() ?? "")
    .replace(/\.(ts|js|tsx|jsx)$/, "")
    .toLowerCase();

  const isTrival = /^(index|types?|constants?|config|setup|main)$/.test(baseName);
  if (isTrival) return Object.freeze([]);

  const hasTest = allFiles.some((f) =>
    isTestFile(f) && (
      f.path.toLowerCase().includes(baseName) ||
      f.content.includes(file.path.split("/").pop()?.replace(/\.(ts|js|tsx|jsx)$/, "") ?? "")
    ),
  );

  if (hasTest) return Object.freeze([]);

  const exportCount = (file.content.match(/\bexport\s+(?:function|class|const|default)/g) ?? []).length;
  if (exportCount === 0) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "UNTESTED_MODULE",
      severity:   "MEDIUM",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    `Module "${baseName}" exports ${exportCount} symbol(s) but has no associated test coverage. Exported surface area without tests is invisible to quality gates.`,
      rule:       "TEST-RATIO-002",
      suggestion: `Create a test file for "${baseName}" covering each exported function/class. Prioritize modules with the most consumers (high fan-in).`,
      snippet:    null,
    }),
  ]);
}

function checkSingleAssertionTests(file: CodeFile): readonly TestArchIssue[] {
  if (!isTestFile(file)) return Object.freeze([]);

  const testBlockCount     = countPatternMatches(file.content, UNIT_TEST_PATTERNS);
  const assertionCount     = countPatternMatches(file.content, ASSERTION_PATTERNS);

  if (testBlockCount === 0 || assertionCount === 0) return Object.freeze([]);

  const ratio = assertionCount / testBlockCount;
  if (ratio >= 1.5) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "TESTS_ONLY_HAPPY_PATH",
      severity:   "LOW",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    `Low assertion density: ${assertionCount} assertion(s) across ${testBlockCount} test block(s) (${ratio.toFixed(1)} per test). Sparse assertions suggest tests only verify trivial output.`,
      rule:       "TEST-RATIO-003",
      suggestion: "Add multiple expect() calls per test case to verify return values, side effects, and state changes. Each test should assert at least 2–3 distinct outcomes.",
      snippet:    null,
    }),
  ]);
}

export function analyzeTestRatio(
  files: readonly CodeFile[],
): RatioAnalysisResult {
  const sourceFiles = files.filter(isSourceFile);
  const testFiles   = files.filter(isTestFile);

  const sourceLineCount = sourceFiles.reduce(
    (sum, f) => sum + countNonEmptyLines(f.content), 0,
  );
  const testLineCount   = testFiles.reduce(
    (sum, f) => sum + countNonEmptyLines(f.content), 0,
  );

  const testToCodeRatio = sourceLineCount > 0
    ? testLineCount / sourceLineCount
    : 1;

  const allIssues: TestArchIssue[] = [];
  let emptyTestCount = 0;

  allIssues.push(...checkTestToCodeRatio(sourceLineCount, testLineCount, sourceFiles));

  for (const sourceFile of sourceFiles.slice(0, 30)) {
    allIssues.push(...checkUntestedModule(sourceFile, files));
  }

  for (const testFile of testFiles) {
    const isEmpty = !hasAnyPattern(testFile.content, UNIT_TEST_PATTERNS);
    if (isEmpty) emptyTestCount++;
    allIssues.push(...checkSingleAssertionTests(testFile));
  }

  return Object.freeze({
    issues:          Object.freeze(allIssues),
    testToCodeRatio,
    sourceLineCount,
    testLineCount,
    emptyTestCount,
  });
}
