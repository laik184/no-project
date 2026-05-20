import type {
  DeadCodeSession,
  IntermediateDeadIssues,
  DeadPhase,
  DeadCodeReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      DeadCodeSession        | null = null;
let _intermediate: IntermediateDeadIssues | null = null;
let _lastReport:   DeadCodeReport         | null = null;
const _history:    DeadCodeReport[]              = [];

export function setSession(session: DeadCodeSession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<DeadCodeSession> | null {
  return _session;
}

export function updatePhase(phase: DeadPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateDeadIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateDeadIssues> | null {
  return _intermediate;
}

export function setLastReport(report: DeadCodeReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<DeadCodeReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly DeadCodeReport[] {
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
