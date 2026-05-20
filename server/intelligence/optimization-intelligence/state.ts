import type {
  OptimizationSession,
  OptimizationFinding,
  OptimizationReport,
  AnalysisStage,
} from "./types.js";

const _sessions = new Map<string, OptimizationSession>();

export function initSession(sessionId: string): void {
  _sessions.set(sessionId, Object.freeze({
    sessionId,
    startedAt: Date.now(),
    stage:     "IDLE" as AnalysisStage,
    findings:  Object.freeze([]),
    report:    null,
  }));
}

export function advanceStage(sessionId: string, stage: AnalysisStage): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  _sessions.set(sessionId, Object.freeze({ ...s, stage }));
}

export function appendFindings(
  sessionId: string,
  incoming:  readonly OptimizationFinding[],
): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  _sessions.set(sessionId, Object.freeze({
    ...s,
    findings: Object.freeze([...s.findings, ...incoming]),
  }));
}

export function setReport(sessionId: string, report: OptimizationReport): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  _sessions.set(sessionId, Object.freeze({
    ...s,
    report,
    stage: "COMPLETE" as AnalysisStage,
  }));
}

export function getFindings(
  sessionId: string,
): readonly OptimizationFinding[] {
  return _sessions.get(sessionId)?.findings ?? Object.freeze([]);
}

export function getSession(
  sessionId: string,
): Readonly<OptimizationSession> | undefined {
  return _sessions.get(sessionId);
}

export function clearSession(sessionId: string): void {
  _sessions.delete(sessionId);
}

export function clearAll(): void {
  _sessions.clear();
}

export function sessionCount(): number {
  return _sessions.size;
}
