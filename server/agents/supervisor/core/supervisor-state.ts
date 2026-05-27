import type { SupervisorSession, SupervisorStatus, ExecutionMode, GoalCategory } from '../types/supervisor.types.ts';
import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';

const sessions = new Map<string, SupervisorSession>();

const VALID_TRANSITIONS: Record<SupervisorStatus, SupervisorStatus[]> = {
  idle:     ['active'],
  active:   ['paused', 'shutdown'],
  paused:   ['active', 'shutdown'],
  shutdown: [],
};

export const supervisorState = {
  create(
    sessionId: string,
    runId: string,
    projectId: string,
    goal: string,
    mode: ExecutionMode,
    category: GoalCategory,
    metadata: Record<string, unknown> = {},
  ): SupervisorSession {
    const session: SupervisorSession = {
      sessionId,
      runId,
      projectId,
      goal,
      mode,
      category,
      status:       'idle',
      startedAt:    new Date(),
      endedAt:      null,
      currentPhase: null,
      retryCount:   0,
      metadata,
    };
    sessions.set(sessionId, session);
    return { ...session };
  },

  transition(sessionId: string, status: SupervisorStatus): SupervisorSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`[supervisor-state] Unknown session: ${sessionId}`);

    const allowed = VALID_TRANSITIONS[session.status];
    if (!allowed.includes(status)) {
      throw new Error(`[supervisor-state] Invalid transition ${session.status} → ${status} for session ${sessionId}`);
    }

    session.status = status;
    if (status === 'shutdown') session.endedAt = new Date();
    return { ...session };
  },

  setPhase(sessionId: string, phase: OrchestrationPhase): void {
    const s = sessions.get(sessionId);
    if (s) s.currentPhase = phase;
  },

  incrementRetry(sessionId: string): number {
    const s = sessions.get(sessionId);
    if (!s) return 0;
    s.retryCount++;
    return s.retryCount;
  },

  setMeta(sessionId: string, key: string, value: unknown): void {
    const s = sessions.get(sessionId);
    if (s) s.metadata[key] = value;
  },

  get(sessionId: string): SupervisorSession | undefined {
    const s = sessions.get(sessionId);
    return s ? { ...s } : undefined;
  },

  getByRunId(runId: string): SupervisorSession | undefined {
    for (const s of sessions.values()) {
      if (s.runId === runId) return { ...s };
    }
    return undefined;
  },

  isActive(sessionId: string): boolean {
    return sessions.get(sessionId)?.status === 'active';
  },

  activeSessions(): SupervisorSession[] {
    return Array.from(sessions.values())
      .filter((s) => s.status === 'active' || s.status === 'paused')
      .map((s) => ({ ...s }));
  },

  clear(sessionId: string): void {
    sessions.delete(sessionId);
  },
};
