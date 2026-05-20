import type { CodeFile, TestArchIssue, CoverageGapResult } from "../types.js";
import {
  ASSERTION_PATTERNS,
  ERROR_PATH_TEST_PATTERNS,
  UNIT_TEST_PATTERNS,
} from "../types.js";
import {
  hasAnyPattern,
  countPatternMatches,
  isTestFile,
  isSourceFile,
  deriveSourceBaseName,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `test-cov-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function checkMissingTestFile(
  sourceFile:  CodeFile,
  allFiles:    readonly CodeFile[],
): readonly TestArchIssue[] {
  const sourceName   = sourceFile.path.split("/").pop() ?? "";
  const baseName     = sourceName.replace(/\.(ts|js|tsx|jsx)$/, "");
  const looksLikeLib = /^(index|main|app|server|config|types|constants|utils?)\./i.test(sourceName);

  const hasTestFile = allFiles.some((f) => {
    if (!isTestFile(f)) return false;
    const testBase = deriveSourceBaseName(f.path)
      .replace(/\.(ts|js|tsx|jsx)$/, "");
    return testBase.toLowerCase() === baseName.toLowerCase() ||
           f.path.toLowerCase().includes(baseName.toLowerCase());
  });

  if (hasTestFile || looksLikeLib) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "NO_TEST_FILE_FOR_SOURCE",
      severity:   "HIGH",
      filePath:   sourceFile.path,
      line:       null,
      column:     null,
      message:    `Source file "${baseName}" has no corresponding test file. Untested code is invisible to quality gates.`,
      rule:       "TEST-COV-001",
      suggestion: `Create a test file at a path like "${baseName}.test.ts" (or in a __tests__/ directory) and cover the primary exported functions/classes.`,
      snippet:    null,
    }),
  ]);
}

function checkEmptyTestFile(file: CodeFile): readonly TestArchIssue[] {
  if (!isTestFile(file)) return Object.freeze([]);

  const hasDescribeOrTest = hasAnyPattern(file.content, UNIT_TEST_PATTERNS);
  if (hasDescribeOrTest)  return Object.freeze([]);

  const trimmed = file.content.trim();
  if (trimmed.length > 0 && trimmed.split("\n").length > 3) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "EMPTY_TEST_FILE",
      severity:   "MEDIUM",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    "Test file exists but contains no test cases (no describe/it/test blocks). Placeholder test files give false confidence in coverage.",
      rule:       "TEST-COV-002",
      suggestion: "Add at minimum one describe() block with it()/test() cases. Remove the file if the module is intentionally untested, so the gap is explicit.",
      snippet:    null,
    }),
  ]);
}

function checkTestWithoutAssertions(file: CodeFile): readonly TestArchIssue[] {
  if (!isTestFile(file)) return Object.freeze([]);

  const hasTests      = hasAnyPattern(file.content, UNIT_TEST_PATTERNS);
  const hasAssertions = hasAnyPattern(file.content, ASSERTION_PATTERNS);

  if (!hasTests || hasAssertions) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "TEST_WITHOUT_ASSERTIONS",
      severity:   "HIGH",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    "Test file contains test blocks but no assertion statements. Tests without assertions always pass and provide zero quality signal.",
      rule:       "TEST-COV-003",
      suggestion: "Add expect(...) / assert.*() calls inside each test case to verify actual output against expected values.",
      snippet:    null,
    }),
  ]);
}

function checkErrorPathCoverage(file: CodeFile): readonly TestArchIssue[] {
  if (!isTestFile(file)) return Object.freeze([]);

  const hasTests         = hasAnyPattern(file.content, UNIT_TEST_PATTERNS);
  const hasErrorPathTest = hasAnyPattern(file.content, ERROR_PATH_TEST_PATTERNS);

  if (!hasTests || hasErrorPathTest) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "MISSING_ERROR_PATH_TEST",
      severity:   "MEDIUM",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    "Test file covers no error paths, rejections, or thrown exceptions. Happy-path-only tests miss the failures most likely to reach production.",
      rule:       "TEST-COV-004",
      suggestion: "Add test cases that exercise error conditions: invalid inputs, rejected promises, thrown exceptions (use expect(() => fn()).toThrow() or rejects).",
      snippet:    null,
    }),
  ]);
}

function checkOnlyHappyPath(file: CodeFile): readonly TestArchIssue[] {
  if (!isTestFile(file)) return Object.freeze([]);

  const testCount  = countPatternMatches(file.content, UNIT_TEST_PATTERNS);
  if (testCount < 3) return Object.freeze([]);

  const errorCount = countPatternMatches(file.content, ERROR_PATH_TEST_PATTERNS);
  if (errorCount > 0) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "TESTS_ONLY_HAPPY_PATH",
      severity:   "LOW",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    `Test file has ${testCount} test case(s) but none appear to test failure or edge-case scenarios. Real-world code fails at the boundaries.`,
      rule:       "TEST-COV-005",
      suggestion: "Add tests for boundary values (null, undefined, empty arrays, max values), concurrent execution, and upstream dependency failures.",
      snippet:    null,
    }),
  ]);
}

export function mapCoverageGaps(
  files: readonly CodeFile[],
): CoverageGapResult {
  const sourceFiles = files.filter(isSourceFile);
  const testFiles   = files.filter(isTestFile);
  const allIssues: TestArchIssue[] = [];
  let untestedFiles = 0;

  for (const sourceFile of sourceFiles) {
    const missingIssues = checkMissingTestFile(sourceFile, files);
    if (missingIssues.length > 0) untestedFiles++;
    allIssues.push(...missingIssues);
  }

  for (const testFile of testFiles) {
    allIssues.push(
      ...checkEmptyTestFile(testFile),
      ...checkTestWithoutAssertions(testFile),
      ...checkErrorPathCoverage(testFile),
      ...checkOnlyHappyPath(testFile),
    );
  }

  return Object.freeze({
    issues:             Object.freeze(allIssues),
    sourceFilesScanned: sourceFiles.length,
    testFilesFound:     testFiles.length,
    untestedFiles,
  });
}
