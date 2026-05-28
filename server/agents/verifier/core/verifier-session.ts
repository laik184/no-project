/**
 * server/agents/verifier/core/verifier-session.ts
 * Active session lifecycle manager for the verifier agent.
 */

import type { VerificationPhase, VerifierLifecycleState } from '../types/verifier.types.ts';

export interface VerifierSessionData {
  runId:      string;
  projectId:  string;
  state:      VerifierLifecycleState;
  phase:      VerificationPhase | 'idle';
  startedAt:  number;
  updatedAt:  number;
}

const sessions = new Map<string, VerifierSessionData>();

export const verifierSession = {
  create(runId: string, projectId: string): VerifierSessionData {
    const data: VerifierSessionData = {
      runId, projectId,
      state:     'idle',
      phase:     'idle',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessions.set(runId, data);
    return data;
  },

  get(runId: string): VerifierSessionData | undefined {
    return sessions.get(runId);
  },

  transition(runId: string, state: VerifierLifecycleState): void {
    const s = sessions.get(runId);
    if (s) { s.state = state; s.updatedAt = Date.now(); }
  },

  setPhase(runId: string, phase: VerificationPhase | 'idle'): void {
    const s = sessions.get(runId);
    if (s) { s.phase = phase; s.updatedAt = Date.now(); }
  },

  complete(runId: string, success: boolean): void {
    const s = sessions.get(runId);
    if (s) {
      s.state     = success ? 'completing' : 'failed';
      s.phase     = 'idle';
      s.updatedAt = Date.now();
    }
  },

  clear(runId: string): void {
    sessions.delete(runId);
  },

  activeSessions(): string[] {
    return [...sessions.keys()].filter((k) => {
      const s = sessions.get(k);
      return s && s.state !== 'completing' && s.state !== 'failed' && s.state !== 'aborted';
    });
  },
};
