import type { CodeFile, TestArchIssue, LayerAnalysisResult } from "../types.js";
import {
  UNIT_TEST_PATTERNS,
  INTEGRATION_TEST_PATTERNS,
  E2E_TEST_PATTERNS,
  MOCK_PATTERNS,
  TEST_FRAMEWORK_PATTERNS,
} from "../types.js";
import {
  hasAnyPattern,
  detectLibraries,
  isTestFile,
  isSourceFile,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `test-layer-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function checkUnitLayer(
  testFiles:    readonly CodeFile[],
  sourceFiles:  readonly CodeFile[],
): { issue: TestArchIssue | null; hasLayer: boolean } {
  if (sourceFiles.length === 0) return { issue: null, hasLayer: true };

  const hasUnitTests = testFiles.some((f) =>
    hasAnyPattern(f.content, UNIT_TEST_PATTERNS),
  );

  if (hasUnitTests) return { issue: null, hasLayer: true };

  return {
    hasLayer: false,
    issue: Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "MISSING_UNIT_TEST_LAYER",
      severity:   "CRITICAL",
      filePath:   sourceFiles[0]?.path ?? "unknown",
      line:       null,
      column:     null,
      message:    `No unit test layer detected (no describe/it/test blocks in any test file). Unit tests are the foundation of a reliable test suite — their absence means no fast, isolated feedback on individual functions.`,
      rule:       "TEST-LAYER-001",
      suggestion: "Set up a test framework (Jest or Vitest recommended) and write unit tests for all pure functions, utilities, and service methods. Aim for at least one describe() block per source module.",
      snippet:    null,
    }),
  };
}

function checkIntegrationLayer(
  testFiles:   readonly CodeFile[],
  sourceFiles: readonly CodeFile[],
): { issue: TestArchIssue | null; hasLayer: boolean } {
  const hasServerCode = sourceFiles.some((f) => {
    const p = f.path.toLowerCase();
    return p.includes("route") || p.includes("controller") ||
           p.includes("handler") || p.includes("api") ||
           p.includes("server") || /app\.(ts|js)$/.test(p);
  });

  if (!hasServerCode) return { issue: null, hasLayer: true };

  const hasIntegrationTests = testFiles.some((f) =>
    hasAnyPattern(f.content, INTEGRATION_TEST_PATTERNS),
  );

  if (hasIntegrationTests) return { issue: null, hasLayer: true };

  return {
    hasLayer: false,
    issue: Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "MISSING_INTEGRATION_TEST_LAYER",
      severity:   "HIGH",
      filePath:   sourceFiles[0]?.path ?? "unknown",
      line:       null,
      column:     null,
      message:    "Server/API code detected but no integration test layer found (no supertest, httpMocks, or request(app) usage). Integration tests verify that routes, middleware, and database layers collaborate correctly.",
      rule:       "TEST-LAYER-002",
      suggestion: "Add integration tests using supertest (e.g., import request from 'supertest'; request(app).get('/route').expect(200)). Place them in a dedicated integration/ or __tests__/integration/ directory.",
      snippet:    null,
    }),
  };
}

function checkE2eLayer(
  testFiles:   readonly CodeFile[],
  allFiles:    readonly CodeFile[],
): { issue: TestArchIssue | null; hasLayer: boolean } {
  const hasFrontendCode = allFiles.some((f) => {
    const p = f.path.toLowerCase();
    return p.endsWith(".tsx") || p.endsWith(".jsx") ||
           p.includes("component") || p.includes("page") ||
           p.includes("view");
  });

  if (!hasFrontendCode) return { issue: null, hasLayer: true };

  const hasE2eTests = testFiles.some((f) =>
    hasAnyPattern(f.content, E2E_TEST_PATTERNS),
  );

  if (hasE2eTests) return { issue: null, hasLayer: true };

  return {
    hasLayer: false,
    issue: Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "MISSING_E2E_TEST_LAYER",
      severity:   "MEDIUM",
      filePath:   allFiles[0]?.path ?? "unknown",
      line:       null,
      column:     null,
      message:    "Frontend components detected but no end-to-end test layer found (no Playwright, Cypress, or Puppeteer). E2E tests protect critical user journeys from regressions.",
      rule:       "TEST-LAYER-003",
      suggestion: "Add at least a smoke-level E2E suite using Playwright or Cypress covering your most critical user flows (login, checkout, core workflow). These tests run against the real UI.",
      snippet:    null,
    }),
  };
}

function checkMockLayer(
  testFiles: readonly CodeFile[],
): { issue: TestArchIssue | null; hasLayer: boolean } {
  if (testFiles.length === 0) return { issue: null, hasLayer: true };

  const hasMocks = testFiles.some((f) =>
    hasAnyPattern(f.content, MOCK_PATTERNS),
  );

  if (hasMocks) return { issue: null, hasLayer: true };

  return {
    hasLayer: false,
    issue: Object.freeze<TestArchIssue>({
      id:         nextId(),
      type:       "MISSING_MOCK_LAYER",
      severity:   "MEDIUM",
      filePath:   testFiles[0]?.path ?? "unknown",
      line:       null,
      column:     null,
      message:    "No mocking library or mock usage detected across test files. Tests that reach real databases, network, or file system are slow, flaky, and environment-dependent.",
      rule:       "TEST-LAYER-004",
      suggestion: "Use jest.mock() / vi.mock() to isolate units from external dependencies. Mock HTTP calls with msw or nock so unit tests remain fast and deterministic.",
      snippet:    null,
    }),
  };
}

function checkFrameworkPresence(
  allFiles: readonly CodeFile[],
): TestArchIssue | null {
  const allContent  = allFiles.map((f) => f.content).join("\n");
  const frameworks  = detectLibraries(allContent, TEST_FRAMEWORK_PATTERNS as ReadonlyArray<{ rx: RegExp; label: string }>);

  if (frameworks.length > 0) return null;

  const hasAnyTestFile = allFiles.some((f) => isTestFile(f));
  if (!hasAnyTestFile)  return null;

  return Object.freeze<TestArchIssue>({
    id:         nextId(),
    type:       "NO_TEST_FRAMEWORK_DETECTED",
    severity:   "CRITICAL",
    filePath:   allFiles[0]?.path ?? "unknown",
    line:       null,
    column:     null,
    message:    "Test files exist but no recognized test framework (Jest, Vitest, Mocha, etc.) is imported or referenced. Tests may not be runnable or discoverable by CI.",
    rule:       "TEST-LAYER-005",
    suggestion: "Install and configure a test runner. Vitest is recommended for Vite/ESM projects; Jest for Node/CommonJS. Ensure the framework is listed in package.json devDependencies and has a config file.",
    snippet:    null,
  });
}

export function analyzeTestLayers(
  files: readonly CodeFile[],
): LayerAnalysisResult {
  const testFiles   = files.filter(isTestFile);
  const sourceFiles = files.filter(isSourceFile);
  const allIssues: TestArchIssue[] = [];

  const unitCheck        = checkUnitLayer(testFiles, sourceFiles);
  const integrationCheck = checkIntegrationLayer(testFiles, sourceFiles);
  const e2eCheck         = checkE2eLayer(testFiles, files);
  const mockCheck        = checkMockLayer(testFiles);
  const frameworkIssue   = checkFrameworkPresence(files);

  if (unitCheck.issue)        allIssues.push(unitCheck.issue);
  if (integrationCheck.issue) allIssues.push(integrationCheck.issue);
  if (e2eCheck.issue)         allIssues.push(e2eCheck.issue);
  if (mockCheck.issue)        allIssues.push(mockCheck.issue);
  if (frameworkIssue)         allIssues.push(frameworkIssue);

  return Object.freeze({
    issues:               Object.freeze(allIssues),
    hasUnitLayer:         unitCheck.hasLayer,
    hasIntegrationLayer:  integrationCheck.hasLayer,
    hasE2eLayer:          e2eCheck.hasLayer,
    hasMockLayer:         mockCheck.hasLayer,
  });
}
