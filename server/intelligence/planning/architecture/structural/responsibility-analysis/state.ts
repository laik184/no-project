import type {
  ResponsibilitySession,
  IntermediateAnalysis,
  AnalysisPhase,
  ResponsibilityReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:   ResponsibilitySession  | null = null;
let _analysis:  IntermediateAnalysis   | null = null;
let _lastReport: ResponsibilityReport  | null = null;
const _history:  ResponsibilityReport[]       = [];

export function setSession(session: ResponsibilitySession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<ResponsibilitySession> | null {
  return _session;
}

export function updatePhase(phase: AnalysisPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateAnalysis(analysis: IntermediateAnalysis): void {
  _analysis = Object.freeze({ ...analysis });
}

export function getIntermediateAnalysis(): Readonly<IntermediateAnalysis> | null {
  return _analysis;
}

export function setLastReport(report: ResponsibilityReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<ResponsibilityReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly ResponsibilityReport[] {
  return Object.freeze([..._history]);
}

export function markComplete(): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase: "COMPLETE" });
}

export function clearSession(): void {
  _session  = null;
  _analysis = null;
}

export function clearAll(): void {
  _session     = null;
  _analysis    = null;
  _lastReport  = null;
  _history.length = 0;
}

export function historyCount(): number {
  return _history.length;
}
