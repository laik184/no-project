import type { VerificationSession, VerificationInput, VerificationStatus, VerificationPhase, PhaseResult } from '../types.ts';
import { randomUUID } from 'node:crypto';

const sessions = new Map<string, VerificationSession>();

export function createSession(input: VerificationInput): VerificationSession {
  const session: VerificationSession = {
    id:        randomUUID(),
    runId:     input.runId,
    projectId: input.projectId,
    status:    'pending',
    startedAt: new Date(),
    phases:    input.phases,
    results:   [],
  };
  sessions.set(input.runId, session);
  return session;
}

export function getSession(runId: string): VerificationSession | undefined {
  return sessions.get(runId);
}

export function requireSession(runId: string): VerificationSession {
  const s = sessions.get(runId);
  if (!s) throw new Error(`[verification-session] No session for runId: ${runId}`);
  return s;
}

export function updateSessionStatus(runId: string, status: VerificationStatus): void {
  requireSession(runId).status = status;
}

export function removeSession(runId: string): void {
  sessions.delete(runId);
}

export function listActiveSessions(): VerificationSession[] {
  return Array.from(sessions.values()).filter((s) => s.status === 'pending' || s.status === 'running');
}

export interface VerificationStateData {
  runId:      string;
  projectId:  string;
  status:     VerificationStatus;
  phases:     VerificationPhase[];
  results:    PhaseResult[];
  startedAt:  Date;
  updatedAt:  Date;
  errorCount: number;
}

const states = new Map<string, VerificationStateData>();

export const verificationState = {
  init(runId: string, projectId: string, phases: VerificationPhase[]): VerificationStateData {
    const state: VerificationStateData = {
      runId, projectId, status: 'running', phases, results: [],
      startedAt: new Date(), updatedAt: new Date(), errorCount: 0,
    };
    states.set(runId, state);
    return state;
  },
  get(runId: string): VerificationStateData | undefined {
    return states.get(runId);
  },
  require(runId: string): VerificationStateData {
    const s = states.get(runId);
    if (!s) throw new Error(`[verification-state] No state for run ${runId}`);
    return s;
  },
  recordPhase(runId: string, result: PhaseResult): void {
    const s = this.require(runId);
    s.results.push(result);
    s.errorCount += result.errors.length;
    s.updatedAt = new Date();
  },
  setStatus(runId: string, status: VerificationStatus): void {
    const s = this.require(runId);
    s.status = status;
    s.updatedAt = new Date();
  },
  clear(runId: string): void {
    states.delete(runId);
  },
  listActive(): string[] {
    return Array.from(states.keys());
  },
};
