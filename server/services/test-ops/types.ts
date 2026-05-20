export type TestOpsStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";

export interface TestCase {
  readonly name: string;
  readonly file: string;
  readonly status: "passed" | "failed" | "skipped";
  readonly durationMs?: number;
  readonly errorMessage?: string;
}

export interface TestResult {
  readonly success: boolean;
  readonly passed: number;
  readonly failed: number;
  readonly coverage?: number;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface CoverageReport {
  readonly enabled: boolean;
  readonly percentage: number;
  readonly statementCoverage?: number;
  readonly branchCoverage?: number;
  readonly functionCoverage?: number;
  readonly lineCoverage?: number;
}

export interface FailureReport {
  readonly hasFailures: boolean;
  readonly reasons: readonly string[];
  readonly files: readonly string[];
}

export interface DiscoveryResult {
  readonly files: readonly string[];
  readonly logs: readonly string[];
}

export interface ExecutorResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly logs: readonly string[];
}

export interface RunnerConfig {
  readonly cwd?: string;
  readonly framework?: "jest" | "vitest" | "node-test";
  readonly timeoutMs?: number;
  readonly coverage?: boolean;
}
