import type {
  HVPAnalysisSession,
  IntermediateImportGraph,
  ValidationPhase,
  HVPComplianceReport,
} from "./types.js";

let _session:     HVPAnalysisSession     | null = null;
let _importGraph: IntermediateImportGraph | null = null;
let _lastReport:  HVPComplianceReport    | null = null;
const _history:   HVPComplianceReport[]         = [];

const MAX_HISTORY = 50;

export function setSession(session: HVPAnalysisSession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<HVPAnalysisSession> | null {
  return _session;
}

export function updatePhase(phase: ValidationPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setImportGraph(graph: IntermediateImportGraph): void {
  _importGraph = Object.freeze({ ...graph });
}

export function getImportGraph(): Readonly<IntermediateImportGraph> | null {
  return _importGraph;
}

export function setLastReport(report: HVPComplianceReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<HVPComplianceReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly HVPComplianceReport[] {
  return Object.freeze([..._history]);
}

export function markComplete(nowMs: number = Date.now()): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase: "COMPLETE", completedAt: nowMs });
}

export function clearSession(): void {
  _session     = null;
  _importGraph = null;
}

export function clearAll(): void {
  _session      = null;
  _importGraph  = null;
  _lastReport   = null;
  _history.length = 0;
}

export function sessionCount(): number {
  return _history.length;
}
