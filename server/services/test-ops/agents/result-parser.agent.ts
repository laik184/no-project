import type { TestCase, TestResult } from "../types.js";
import { appendLog } from "../utils/logger.util.js";
import { parsePassFailCounts, parseTestCases } from "../utils/output-parser.util.js";

export interface ParsedResult {
  readonly testResult: TestResult;
  readonly tests: readonly TestCase[];
  readonly logs: readonly string[];
}

export function parseResults(stdout: string, stderr: string, exitCode: number): ParsedResult {
  let logs = Object.freeze([]) as readonly string[];

  const parsedCounts = parsePassFailCounts(`${stdout}\n${stderr}`);
  const tests = parseTestCases(stdout);
  logs = appendLog(logs, "INFO", `Parsed results: passed=${parsedCounts.passed}, failed=${parsedCounts.failed}`);

  const testResult: TestResult = Object.freeze({
    success: exitCode === 0 && parsedCounts.failed === 0,
    passed: parsedCounts.passed,
    failed: parsedCounts.failed,
    logs: Object.freeze([...logs]),
    error: exitCode === 0 ? undefined : (stderr || "Test execution failed"),
  });

  return Object.freeze({ testResult, tests, logs });
}
