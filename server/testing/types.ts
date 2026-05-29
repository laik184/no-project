export type TestFramework = "jest" | "vitest" | "mocha" | "pytest" | "cargo-test" | "go-test";

export type TestStatus = "pending" | "running" | "passed" | "failed" | "skipped" | "timeout";

export interface TestRun {
  id: string;
  projectId: string;
  framework: TestFramework;
  status: TestStatus;
  suites: TestSuite[];
  summary: TestSummary;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  file: string;
  status: TestStatus;
  tests: TestCase[];
  durationMs?: number;
}

export interface TestCase {
  id: string;
  name: string;
  fullName: string;
  status: TestStatus;
  durationMs?: number;
  error?: TestError;
  stdout?: string;
  stderr?: string;
}

export interface TestError {
  message: string;
  stack?: string;
  expected?: string;
  actual?: string;
  diff?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface CoverageReport {
  projectId: string;
  testRunId: string;
  files: Array<{
    path: string;
    lines: number;
    coveredLines: number;
    branches: number;
    coveredBranches: number;
    functions: number;
    coveredFunctions: number;
    percent: number;
  }>;
  overall: {
    lines: number;
    branches: number;
    functions: number;
  };
}

export interface RunTestsPayload {
  projectId: string;
  framework: TestFramework;
  pattern?: string;        // test file glob
  testName?: string;       // run single test
  coverage?: boolean;
  watch?: boolean;
}
