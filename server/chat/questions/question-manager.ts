import crypto from 'crypto';
import type { ChatQuestion, AskQuestionPayload, QuestionStatus } from '../types/question.types.ts';
import { QUESTION_TTL_MS } from '../constants/stream.constants.ts';

const _questions = new Map<string, ChatQuestion>();

export const questionManager = {
  create(payload: AskQuestionPayload): ChatQuestion {
    const now       = new Date();
    const ttl       = payload.ttlMs ?? QUESTION_TTL_MS;
    const question: ChatQuestion = {
      questionId: crypto.randomUUID(),
      runId:      payload.runId,
      projectId:  payload.projectId,
      kind:       payload.kind,
      text:       payload.text,
      options:    payload.options,
      status:     'pending',
      askedAt:    now,
      expiresAt:  new Date(now.getTime() + ttl),
    };
    _questions.set(question.questionId, question);

    setTimeout(() => {
      const q = _questions.get(question.questionId);
      if (q && q.status === 'pending') {
        q.status = 'expired';
      }
    }, ttl);

    return question;
  },

  get(questionId: string): ChatQuestion | null {
    return _questions.get(questionId) ?? null;
  },

  answer(questionId: string, answer: string): ChatQuestion | null {
    const q = _questions.get(questionId);
    if (!q || q.status !== 'pending') return null;
    q.status      = 'answered';
    q.answer      = answer;
    q.answeredAt  = new Date();
    return q;
  },

  cancel(questionId: string): boolean {
    const q = _questions.get(questionId);
    if (!q) return false;
    q.status = 'cancelled';
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
    return [..._questions.values()].filter(
      (q) => q.runId === runId && q.status === 'pending',
    );
  },

  size(): number { return _questions.size; },
};
