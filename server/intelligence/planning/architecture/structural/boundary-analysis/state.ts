import type {
  BoundarySession,
  IntermediateViolations,
  ValidationPhase,
  BoundaryReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:    BoundarySession        | null = null;
let _intermediate: IntermediateViolations | null = null;
let _lastReport: BoundaryReport          | null = null;
const _history:  BoundaryReport[]               = [];

export function setSession(session: BoundarySession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<BoundarySession> | null {
  return _session;
}

export function updatePhase(phase: ValidationPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateViolations(iv: IntermediateViolations): void {
  _intermediate = Object.freeze({ ...iv });
}

export function getIntermediateViolations(): Readonly<IntermediateViolations> | null {
  return _intermediate;
}

export function setLastReport(report: BoundaryReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<BoundaryReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly BoundaryReport[] {
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
  _session      = null;
  _intermediate = null;
  _lastReport   = null;
  _history.length = 0;
}

export function historyCount(): number {
  return _history.length;
}
