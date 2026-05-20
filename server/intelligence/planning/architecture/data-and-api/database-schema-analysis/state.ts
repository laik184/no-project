import type {
  DbSchemaSession,
  IntermediateDbIssues,
  DbPhase,
  DbSchemaReport,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:      DbSchemaSession       | null = null;
let _intermediate: IntermediateDbIssues  | null = null;
let _lastReport:   DbSchemaReport        | null = null;
const _history:    DbSchemaReport[]             = [];

export function setSession(session: DbSchemaSession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<DbSchemaSession> | null {
  return _session;
}

export function updatePhase(phase: DbPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setIntermediateIssues(issues: IntermediateDbIssues): void {
  _intermediate = Object.freeze({ ...issues });
}

export function getIntermediateIssues(): Readonly<IntermediateDbIssues> | null {
  return _intermediate;
}

export function setLastReport(report: DbSchemaReport): void {
  _lastReport = report;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(report);
}

export function getLastReport(): Readonly<DbSchemaReport> | null {
  return _lastReport;
}

export function getReportHistory(): readonly DbSchemaReport[] {
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
