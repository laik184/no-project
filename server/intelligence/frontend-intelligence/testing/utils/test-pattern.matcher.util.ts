import type { TestFramework, TestFileDescriptor } from "../types.js";

const TEST_FILE_PATTERNS: readonly RegExp[] = Object.freeze([
  /\.test\.(tsx?|jsx?|mjs)$/i,
  /\.spec\.(tsx?|jsx?|mjs)$/i,
  /__tests__\//i,
  /\.stories\.(tsx?|jsx?)$/i,
  /\/tests?\//i,
  /\/e2e\//i,
  /\/cypress\//i,
]);

const FRAMEWORK_PATTERNS: Readonly<Record<TestFramework, readonly RegExp[]>> = Object.freeze({
  jest: [/jest/i, /\.test\.(tsx?|jsx?)$/i, /@testing-library/i],
  vitest: [/vitest/i, /\.test\.(tsx?|jsx?)$/i],
  playwright: [/playwright/i, /e2e/i, /\.spec\.ts$/i],
  cypress: [/cypress/i, /\/cypress\//i],
  "testing-library": [/@testing-library/i, /userEvent/i, /render\(/i],
  unknown: [],
});

export function isTestFilePath(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filePath));
}

export function extractBaseNameFromTestPath(testPath: string): string {
  const fileName = testPath.split("/").pop() ?? "";
  return fileName
    .replace(/\.(test|spec)\.(tsx?|jsx?|mjs)$/i, "")
    .replace(/\.stories\.(tsx?|jsx?)$/i, "")
    .toLowerCase();
}

export function extractBaseNameFromComponentPath(componentPath: string): string {
  const fileName = componentPath.split("/").pop() ?? "";
  return fileName.replace(/\.(tsx?|jsx?|mjs)$/i, "").toLowerCase();
}

export function componentMatchesTestFile(
  componentName: string,
  testFile: TestFileDescriptor
): boolean {
  const lowerComponent = componentName.toLowerCase();

  if (
    testFile.testedComponentNames.some(
      (n) => n.toLowerCase() === lowerComponent
    )
  ) {
    return true;
  }

  const testBase = extractBaseNameFromTestPath(testFile.filePath);
  return testBase === lowerComponent;
}

export function detectFrameworkFromPath(filePath: string): TestFramework {
  const lower = filePath.toLowerCase();
  if (FRAMEWORK_PATTERNS.playwright.some((p) => p.test(lower))) return "playwright";
  if (FRAMEWORK_PATTERNS.cypress.some((p) => p.test(lower))) return "cypress";
  if (FRAMEWORK_PATTERNS.vitest.some((p) => p.test(lower))) return "vitest";
  if (FRAMEWORK_PATTERNS.jest.some((p) => p.test(lower))) return "jest";
  return "unknown";
}

export function deduplicateFrameworks(
  testFiles: readonly TestFileDescriptor[]
): readonly TestFramework[] {
  const seen = new Set<TestFramework>();
  for (const f of testFiles) {
    if (f.testFramework !== "unknown") seen.add(f.testFramework);
  }
  if (seen.size === 0) return Object.freeze(["unknown"]);
  return Object.freeze(Array.from(seen));
}
