import type {
  PerformanceSession,
  IntermediateIssues,
  PerformancePhase,
  PerformanceReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      PerformanceSession    | null = null;
let _intermediate: IntermediateIssues    | null = null;
let _lastReport:   PerformanceReport     | null = null;
const _history:    PerformanceReport[]          = [];

export function setSession(session: PerformanceSession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<PerformanceSession> | null {
  return _session;
}

export function updatePhase(phase: PerformancePhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateIssues> | null {
  return _intermediate;
}

export function setLastReport(report: PerformanceReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<PerformanceReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly PerformanceReport[] {
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
