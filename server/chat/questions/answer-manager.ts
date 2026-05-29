/**
 * answer-manager.ts — Processes and validates answers to chat questions.
 * Single responsibility: validate answer payload + coordinate state update.
 */
import { questionManager }        from './question-manager.ts';
import { eventPublisher }         from '../realtime/event-publisher.ts';
import { makeQuestionAnsweredEvent } from '../events/question.events.ts';
import type { ChatQuestion } from '../types/question.types.ts';

type SubmitPayload = { questionId: string; runId: string; answer: string };

export class AnswerError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'NOT_PENDING' | 'INVALID_OPTION',
  ) {
    super(message);
    this.name = 'AnswerError';
  }
}

export const answerManager = {
  /**
   * Submit an answer for a pending question.
   * Validates the question exists, is pending, and the answer is in options.
   * Publishes question.answered event.
   * Returns the updated question.
   */
  submit(payload: SubmitPayload): ChatQuestion {
    const question = questionManager.get(payload.questionId);

    if (!question) {
      throw new AnswerError(
        `Question ${payload.questionId} not found`,
        'NOT_FOUND',
      );
    }

    if (question.status !== 'pending') {
      throw new AnswerError(
        `Question ${payload.questionId} is ${question.status} — cannot answer`,
        'NOT_PENDING',
      );
    }

    if (question.options.length > 0 && !question.options.includes(payload.answer)) {
      throw new AnswerError(
        `Answer "${payload.answer}" is not in the allowed options: ${question.options.join(', ')}`,
        'INVALID_OPTION',
      );
    }

    const updated = questionManager.answer(payload.questionId, payload.answer);
    if (!updated) {
      throw new AnswerError(
        `Failed to record answer for question ${payload.questionId}`,
        'NOT_PENDING',
      );
    }

    eventPublisher.publish(
      makeQuestionAnsweredEvent(
        updated.questionId,
        updated.runId,
        updated.projectId,
        updated.answer!,
      ),
    );

    return updated;
  },
};
