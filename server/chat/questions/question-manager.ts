/**
 * question-manager.ts — In-memory lifecycle manager for chat questions.
 * Owns: create, find, expire, cancel questions.
 */
import crypto from 'crypto';
import type { ChatQuestion, AskQuestionPayload, QuestionStatus } from '../types/question.types.ts';
import { QUESTION_TTL_MS } from '../constants/stream.constants.ts';

const _questions = new Map<string, ChatQuestion>();

function evictExpired(): void {
  const now = new Date();
  for (const [id, q] of _questions) {
    if (q.expiresAt && q.expiresAt <= now && q.status === 'pending') {
      q.status = 'expired';
      _questions.set(id, q);
    }
  }
}

export const questionManager = {
  create(payload: AskQuestionPayload): ChatQuestion {
    evictExpired();
    const now = new Date();
    const question: ChatQuestion = {
      questionId: crypto.randomUUID(),
      runId:      payload.runId,
      projectId:  payload.projectId,
      kind:       payload.kind,
      text:       payload.text,
      options:    payload.options,
      status:     'pending',
      askedAt:    now,
      expiresAt:  new Date(now.getTime() + (payload.ttlMs ?? QUESTION_TTL_MS)),
    };
    _questions.set(question.questionId, question);
    return question;
  },

  get(questionId: string): ChatQuestion | null {
    evictExpired();
    return _questions.get(questionId) ?? null;
  },

  answer(questionId: string, answer: string): ChatQuestion | null {
    const q = _questions.get(questionId);
    if (!q || q.status !== 'pending') return null;
    q.status     = 'answered';
    q.answer     = answer;
    q.answeredAt = new Date();
    _questions.set(questionId, q);
    return q;
  },

  cancel(questionId: string): boolean {
    const q = _questions.get(questionId);
    if (!q || q.status !== 'pending') return false;
    q.status = 'cancelled';
    _questions.set(questionId, q);
    return true;
  },

  cancelByRun(runId: string): number {
    let count = 0;
    for (const q of _questions.values()) {
      if (q.runId === runId && q.status === 'pending') {
        q.status = 'cancelled';
        count++;
      }
    }
    return count;
  },

  listPendingByRun(runId: string): ChatQuestion[] {
    evictExpired();
    return Array.from(_questions.values())
      .filter((q) => q.runId === runId && q.status === 'pending');
  },

  size(): number {
    return _questions.size;
  },
};
