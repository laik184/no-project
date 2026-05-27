export type DiffStatus = 'pending' | 'approved' | 'rejected';

export interface DiffSession {
  sessionId:  string;
  projectId:  number;
  runId?:     string;
  diff:       string;
  status:     DiffStatus;
  createdAt:  number;
}

const sessions = new Map<string, DiffSession>();

export const diffSessionStore = {
  add(session: Omit<DiffSession, 'status' | 'createdAt'>): DiffSession {
    const full: DiffSession = { ...session, status: 'pending', createdAt: Date.now() };
    sessions.set(session.sessionId, full);
    return full;
  },
  get(sessionId: string): DiffSession | undefined {
    return sessions.get(sessionId);
  },
  setStatus(sessionId: string, status: DiffStatus): void {
    const s = sessions.get(sessionId);
    if (s) s.status = status;
  },
  getAllPending(): DiffSession[] {
    return [...sessions.values()].filter(s => s.status === 'pending');
  },
  getPendingForProject(projectId: number): DiffSession[] {
    return [...sessions.values()].filter(s => s.projectId === projectId && s.status === 'pending');
  },
};

export function getPendingForProject(projectId: number): DiffSession[] {
  return diffSessionStore.getPendingForProject(projectId);
}

export function getAllPending(): DiffSession[] {
  return diffSessionStore.getAllPending();
}
