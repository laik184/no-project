import { diffSessionStore } from './diff-session.store.ts';

export interface ApprovalResult {
  sessionId: string;
  status:    'approved' | 'rejected';
  ts:        number;
}

export async function approve(sessionId: string): Promise<ApprovalResult | { error: string }> {
  const session = diffSessionStore.get(sessionId);
  if (!session) return { error: `Session ${sessionId} not found` };
  diffSessionStore.setStatus(sessionId, 'approved');
  return { sessionId, status: 'approved', ts: Date.now() };
}

export async function reject(sessionId: string): Promise<ApprovalResult | { error: string }> {
  const session = diffSessionStore.get(sessionId);
  if (!session) return { error: `Session ${sessionId} not found` };
  diffSessionStore.setStatus(sessionId, 'rejected');
  return { sessionId, status: 'rejected', ts: Date.now() };
}
