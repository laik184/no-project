import type {
  PlanningSession,
  PlanningPhase,
  UserGoal,
  RefinedPrompt,
  StructuredIntent,
  CapabilityMap,
  AtomicTask,
  TaskDependencyMap,
  ExecutionStrategy,
  RiskAssessment,
  PlanValidationReport,
} from "./types.ts";

let _session: PlanningSession | null = null;

export function initSession(goal: UserGoal, sessionId: string): void {
  _session = Object.freeze({
    sessionId,
    goal:          Object.freeze(goal),
    phase:         "idle" as PlanningPhase,
    createdAt:     Date.now(),
    intermediates: Object.freeze({}),
  });
}

export function getSession(): Readonly<PlanningSession> | null {
  return _session;
}

export function setPhase(phase: PlanningPhase): void {
  if (_session === null) return;
  _session = Object.freeze({ ..._session, phase });
}

export function setRefinedPrompt(refinedPrompt: RefinedPrompt): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({ ..._session.intermediates, refinedPrompt }),
  });
}

export function setIntent(intent: StructuredIntent): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({ ..._session.intermediates, intent }),
  });
}

export function setCapabilityMap(capabilityMap: CapabilityMap): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({ ..._session.intermediates, capabilityMap }),
  });
}

export function setTasks(tasks: readonly AtomicTask[]): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({
      ..._session.intermediates,
      tasks: Object.freeze([...tasks]),
    }),
  });
}

export function setDependencyMap(dependencyMap: TaskDependencyMap): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({ ..._session.intermediates, dependencyMap }),
  });
}

export function setStrategy(strategy: ExecutionStrategy): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({ ..._session.intermediates, strategy }),
  });
}

export function setRiskAssessment(riskAssessment: RiskAssessment): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({ ..._session.intermediates, riskAssessment }),
  });
}

export function setValidationReport(validationReport: PlanValidationReport): void {
  if (_session === null) return;
  _session = Object.freeze({
    ..._session,
    intermediates: Object.freeze({ ..._session.intermediates, validationReport }),
  });
}

export function clearSession(): void {
  _session = null;
}
