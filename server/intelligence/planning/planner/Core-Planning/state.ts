import type {
  PlanningSession,
  PlanningStage,
  GoalInput,
  AnalyzedGoal,
  IntermediateTaskGraph,
  ExecutionLevel,
} from "./types.js";

let _session: PlanningSession | null = null;

export function initSession(goal: GoalInput, sessionId: string): void {
  _session = Object.freeze<PlanningSession>({
    sessionId,
    goal:         Object.freeze(goal),
    stage:        "idle",
    createdAt:    Date.now(),
    intermediate: Object.freeze({}),
  });
}

export function getSession(): Readonly<PlanningSession> | null {
  return _session;
}

export function setStage(stage: PlanningStage): void {
  if (_session === null) return;
  _session = Object.freeze<PlanningSession>({ ..._session, stage });
}

export function setAnalyzedGoal(analyzedGoal: AnalyzedGoal): void {
  if (_session === null) return;
  _session = Object.freeze<PlanningSession>({
    ..._session,
    intermediate: Object.freeze({
      ..._session.intermediate,
      analyzedGoal: Object.freeze(analyzedGoal),
    }),
  });
}

export function setTaskGraph(taskGraph: IntermediateTaskGraph): void {
  if (_session === null) return;
  _session = Object.freeze<PlanningSession>({
    ..._session,
    intermediate: Object.freeze({
      ..._session.intermediate,
      taskGraph: Object.freeze(taskGraph),
    }),
  });
}

export function setExecutionLevels(executionLevels: readonly ExecutionLevel[]): void {
  if (_session === null) return;
  _session = Object.freeze<PlanningSession>({
    ..._session,
    intermediate: Object.freeze({
      ..._session.intermediate,
      executionLevels: Object.freeze([...executionLevels]),
    }),
  });
}

export function clearSession(): void {
  _session = null;
}
