import type {
  ComplexitySession,
  IntermediateComplexityIssues,
  ComplexityPhase,
  ComplexityReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      ComplexitySession             | null = null;
let _intermediate: IntermediateComplexityIssues  | null = null;
let _lastReport:   ComplexityReport              | null = null;
const _history:    ComplexityReport[]                   = [];

export function setSession(session: ComplexitySession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<ComplexitySession> | null {
  return _session;
}

export function updatePhase(phase: ComplexityPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateComplexityIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateComplexityIssues> | null {
  return _intermediate;
}

export function setLastReport(report: ComplexityReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<ComplexityReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly ComplexityReport[] {
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
