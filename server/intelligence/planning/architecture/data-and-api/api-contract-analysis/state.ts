import type {
  ApiContractSession,
  IntermediateContractIssues,
  ApiContractPhase,
  ApiContractReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      ApiContractSession         | null = null;
let _intermediate: IntermediateContractIssues | null = null;
let _lastReport:   ApiContractReport          | null = null;
const _history:    ApiContractReport[]               = [];

export function setSession(session: ApiContractSession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<ApiContractSession> | null {
  return _session;
}

export function updatePhase(phase: ApiContractPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateContractIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateContractIssues> | null {
  return _intermediate;
}

export function setLastReport(report: ApiContractReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<ApiContractReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly ApiContractReport[] {
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
