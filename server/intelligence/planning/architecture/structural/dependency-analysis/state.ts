import type {
  DependencySession,
  DependencyGraph,
  DependencyMetrics,
  AnalysisPhase,
  DependencyAnalysisResult,
} from "./types.js";

const MAX_HISTORY = 50;

let _session:    DependencySession         | null = null;
let _graph:      DependencyGraph           | null = null;
let _metrics:    DependencyMetrics         | null = null;
let _lastResult: DependencyAnalysisResult  | null = null;
const _history:  DependencyAnalysisResult[]       = [];

export function setSession(session: DependencySession): void {
  _session = Object.freeze({ ...session });
}

export function getSession(): Readonly<DependencySession> | null {
  return _session;
}

export function updatePhase(phase: AnalysisPhase): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setGraph(graph: DependencyGraph): void {
  _graph = graph;
}

export function getGraph(): Readonly<DependencyGraph> | null {
  return _graph;
}

export function setMetrics(metrics: DependencyMetrics): void {
  _metrics = Object.freeze({ ...metrics });
}

export function getMetrics(): Readonly<DependencyMetrics> | null {
  return _metrics;
}

export function setLastResult(result: DependencyAnalysisResult): void {
  _lastResult = result;
  if (_history.length >= MAX_HISTORY) _history.shift();
  _history.push(result);
}

export function getLastResult(): Readonly<DependencyAnalysisResult> | null {
  return _lastResult;
}

export function getResultHistory(): readonly DependencyAnalysisResult[] {
  return Object.freeze([..._history]);
}

export function markComplete(): void {
  if (!_session) return;
  _session = Object.freeze({ ..._session, phase: "COMPLETE" });
}

export function clearSession(): void {
  _session = null;
  _graph   = null;
  _metrics = null;
}

export function clearAll(): void {
  _session    = null;
  _graph      = null;
  _metrics    = null;
  _lastResult = null;
  _history.length = 0;
}

export function historyCount(): number {
  return _history.length;
}
