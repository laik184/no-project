import { runTestOrchestration } from "./orchestrator.js";
import { getState } from "./state.js";
import type { RunnerConfig, TestResult } from "./types.js";

export async function runTests(config: RunnerConfig = {}): Promise<TestResult> {
  return runTestOrchestration(config);
}

export function getCoverage(): number {
  return getState().coverage;
}

export function getFailures(): readonly string[] {
  return getState().failureReport.reasons;
}

export type {
  TestCase,
  TestResult,
  CoverageReport,
  FailureReport,
  RunnerConfig,
} from "./types.js";
