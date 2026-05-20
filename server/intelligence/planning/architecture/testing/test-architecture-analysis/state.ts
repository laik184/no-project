import type {
  TestArchSession,
  IntermediateTestIssues,
  TestPhase,
  TestArchReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      TestArchSession        | null = null;
let _intermediate: IntermediateTestIssues | null = null;
let _lastReport:   TestArchReport         | null = null;
const _history:    TestArchReport[]              = [];

export function setSession(session: TestArchSession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<TestArchSession> | null {
  return _session;
}

export function updatePhase(phase: TestPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateTestIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateTestIssues> | null {
  return _intermediate;
}

export function setLastReport(report: TestArchReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<TestArchReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly TestArchReport[] {
  return Object.freeze([..._history]);
}

export function markComplete(): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase: "COMPLETE" });
}

export function clearSession(): void {
  _session      = null;
  _intermediate = null;
}

export function clearAll(): void {
  _session        = null;
  _intermediate   = null;
  _lastReport     = null;
  _history.length = 0;
}

export function historyCount(): number {
  return _history.length;
}
