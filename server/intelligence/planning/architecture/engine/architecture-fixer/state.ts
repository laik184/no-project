import type { FixSession, FixStatus } from "./types.js";

interface FixerState {
  readonly activeSession: FixSession | null;
  readonly totalSessionsRun: number;
  readonly lastRunAt:  number;
}

let state: FixerState = Object.freeze({
  activeSession:    null,
  totalSessionsRun: 0,
  lastRunAt:        0,
});

export function getFixerState(): Readonly<FixerState> {
  return state;
}

export function setActiveSession(session: FixSession): Readonly<FixerState> {
  state = Object.freeze({
    activeSession:    Object.freeze(session),
    totalSessionsRun: state.totalSessionsRun + 1,
    lastRunAt:        Date.now(),
  });
  return state;
}

export function updateActiveStatus(status: FixStatus): Readonly<FixerState> {
  if (!state.activeSession) return state;
  state = Object.freeze({
    ...state,
    activeSession: Object.freeze({ ...state.activeSession, status }),
  });
  return state;
}

export function clearFixerState(): void {
  state = Object.freeze({
    activeSession:    null,
    totalSessionsRun: 0,
    lastRunAt:        0,
  });
}

// ── Merged from state/fix-session.state (session history tracking) ────────────
const sessionHistory: FixSession[] = [];

export function setSession(session: FixSession): void {
  setActiveSession(session);
  sessionHistory.push(session);
}

export function getSession(): Readonly<FixSession> | null {
  return state.activeSession;
}

export function updateSessionStatus(status: FixStatus): void {
  updateActiveStatus(status);
  if (state.activeSession) {
    sessionHistory[sessionHistory.length - 1] = state.activeSession;
  }
}

export function getSessionHistory(): readonly FixSession[] {
  return Object.freeze([...sessionHistory]);
}

export function clearSessions(): void {
  clearFixerState();
  sessionHistory.length = 0;
}
