import { randomUUID } from 'crypto';
import type { PlannerInput, ExecutionPlan } from '../types/planner.types.ts';
import type { PlanningContext } from './planning-context.ts';
import type { PlanningState } from './planning-state.ts';
import { createPlanningContext } from './planning-context.ts';
import {
  createInitialState,
  transitionToRunning,
  transitionToCompleted,
  transitionToFailed,
  isTerminal,
} from './planning-state.ts';

export interface PlanningSession {
  sessionId: string;
  context:   PlanningContext;
  state:     PlanningState;
}

const sessions = new Map<string, PlanningSession>();

export function createSession(input: PlannerInput): PlanningSession {
  const sessionId = `psess_${randomUUID().slice(0, 12)}`;
  const context   = createPlanningContext(input);
  const state     = createInitialState();
  const session   = { sessionId, context, state };
  sessions.set(sessionId, session);
  return session;
}

export function startSession(sessionId: string): PlanningSession {
  const session = getSessionOrThrow(sessionId);
  const updated = { ...session, state: transitionToRunning(session.state) };
  sessions.set(sessionId, updated);
  return updated;
}

export function completeSession(sessionId: string, plan: ExecutionPlan): PlanningSession {
  const session = getSessionOrThrow(sessionId);
  const updated = { ...session, state: transitionToCompleted(session.state, plan) };
  sessions.set(sessionId, updated);
  return updated;
}

export function failSession(sessionId: string, error: string): PlanningSession {
  const session = getSessionOrThrow(sessionId);
  const updated = { ...session, state: transitionToFailed(session.state, error) };
  sessions.set(sessionId, updated);
  return updated;
}

export function getSession(sessionId: string): PlanningSession | undefined {
  return sessions.get(sessionId);
}

export function removeSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function listActiveSessions(): PlanningSession[] {
  return Array.from(sessions.values()).filter((s) => !isTerminal(s.state));
}

function getSessionOrThrow(sessionId: string): PlanningSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Planning session '${sessionId}' not found`);
  return session;
}
