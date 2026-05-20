import type { FailureReport, TestCase, TestOpsStatus, TestResult } from "./types.js";

export interface TestOpsState {
  readonly tests: readonly TestCase[];
  readonly passed: number;
  readonly failed: number;
  readonly coverage: number;
  readonly status: TestOpsStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
  readonly failureReport: FailureReport;
  readonly lastResult: TestResult | null;
}

const DEFAULT_FAILURE: FailureReport = Object.freeze({
  hasFailures: false,
  reasons: Object.freeze([]),
  files: Object.freeze([]),
});

const INITIAL_STATE: TestOpsState = Object.freeze({
  tests: Object.freeze([]),
  passed: 0,
  failed: 0,
  coverage: 0,
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
  failureReport: DEFAULT_FAILURE,
  lastResult: null,
});

let _state: TestOpsState = INITIAL_STATE;

function freezeState(next: Omit<TestOpsState, "failureReport"> & { failureReport: FailureReport }): TestOpsState {
  return Object.freeze({
    ...next,
    tests: Object.freeze([...next.tests]),
    logs: Object.freeze([...next.logs]),
    errors: Object.freeze([...next.errors]),
    failureReport: Object.freeze({
      hasFailures: next.failureReport.hasFailures,
      reasons: Object.freeze([...next.failureReport.reasons]),
      files: Object.freeze([...next.failureReport.files]),
    }),
    lastResult: next.lastResult ? Object.freeze({ ...next.lastResult, logs: Object.freeze([...next.lastResult.logs]) }) : null,
  });
}

export function updateState(mutator: (current: Readonly<TestOpsState>) => TestOpsState): void {
  _state = freezeState(mutator(_state));
}

export function getState(): Readonly<TestOpsState> {
  return _state;
}

export function resetState(): void {
  _state = INITIAL_STATE;
}
