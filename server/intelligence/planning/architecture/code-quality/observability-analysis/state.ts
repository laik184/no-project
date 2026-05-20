import type {
  ObservabilitySession,
  IntermediateObsIssues,
  ObsPhase,
  ObservabilityReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      ObservabilitySession    | null = null;
let _intermediate: IntermediateObsIssues  | null = null;
let _lastReport:   ObservabilityReport    | null = null;
const _history:    ObservabilityReport[]         = [];

export function setSession(session: ObservabilitySession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<ObservabilitySession> | null {
  return _session;
}

export function updatePhase(phase: ObsPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateObsIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateObsIssues> | null {
  return _intermediate;
}

export function setLastReport(report: ObservabilityReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<ObservabilityReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly ObservabilityReport[] {
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
