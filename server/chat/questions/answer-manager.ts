import { questionManager }            from './question-manager.ts';
import { eventPublisher }             from '../realtime/event-publisher.ts';
import { makeQuestionAnsweredEvent }  from '../events/question.events.ts';
import type { ChatQuestion }          from '../types/question.types.ts';

export class AnswerError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'NOT_PENDING' | 'INVALID_OPTION',
  ) {
    super(message);
    this.name = 'AnswerError';
  }
}

export interface SubmitPayload {
  questionId: string;
  answer:     string;
}

export const answerManager = {
  submit(payload: SubmitPayload): ChatQuestion {
    const q = questionManager.get(payload.questionId);
    if (!q) throw new AnswerError(`Question ${payload.questionId} not found`, 'NOT_FOUND');
    if (q.status !== 'pending') throw new AnswerError(`Question ${payload.questionId} is ${q.status}`, 'NOT_PENDING');

    if (q.options.length > 0 && !q.options.includes(payload.answer)) {
      throw new AnswerError(`"${payload.answer}" is not a valid option`, 'INVALID_OPTION');
    }

    const answered = questionManager.answer(payload.questionId, payload.answer);
    if (!answered) throw new AnswerError('Failed to record answer', 'NOT_FOUND');

    eventPublisher.publish(
      makeQuestionAnsweredEvent(q.questionId, q.runId, q.projectId, payload.answer) as Record<string, unknown>,
    );

    return answered;
  },
};
