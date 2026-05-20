import type {
  SecuritySession,
  IntermediateSecurityIssues,
  SecurityPhase,
  SecurityReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      SecuritySession             | null = null;
let _intermediate: IntermediateSecurityIssues  | null = null;
let _lastReport:   SecurityReport              | null = null;
const _history:    SecurityReport[]                   = [];

export function setSession(session: SecuritySession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<SecuritySession> | null {
  return _session;
}

export function updatePhase(phase: SecurityPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateSecurityIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateSecurityIssues> | null {
  return _intermediate;
}

export function setLastReport(report: SecurityReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<SecurityReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly SecurityReport[] {
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
