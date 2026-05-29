/**
 * clarification-manager.ts — Manages the full clarification workflow.
 * Owns: detect ambiguity → ask question → collect answer → refine goal.
 */
import { analyzeAmbiguity, buildClarificationText } from './ambiguity-detector.ts';
import { questionManager }   from './question-manager.ts';
import { eventPublisher }    from '../realtime/event-publisher.ts';
import { makeQuestionAskedEvent } from '../events/question.events.ts';
import type { ClarificationContext } from '../types/question.types.ts';
import type { ChatQuestion } from '../types/question.types.ts';
import { ANSWER_POLL_MS, ANSWER_WAIT_TIMEOUT_MS } from '../constants/stream.constants.ts';

export const clarificationManager = {
  /**
   * Analyse goal and, if ambiguous, create a pending question.
   * Returns the question or null if no clarification needed.
   */
  maybeAskClarification(
    runId:     string,
    projectId: number,
    goal:      string,
  ): ChatQuestion | null {
    const analysis = analyzeAmbiguity(goal);
    if (!analysis.isAmbiguous) return null;

    const text    = buildClarificationText(analysis.ambiguities);
    const options = ['Continue as-is', 'Provide more detail', 'Start over'];

    const question = questionManager.create({
      runId,
      projectId,
      kind:    'ambiguity',
      text,
      options,
    });

    eventPublisher.publish(makeQuestionAskedEvent(question));
    return question;
  },

  /**
   * Poll until an answer arrives or timeout elapses.
   * Returns the answer string or null on timeout.
   */
  async waitForAnswer(
    questionId: string,
    timeoutMs = ANSWER_WAIT_TIMEOUT_MS,
  ): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const q = questionManager.get(questionId);
      if (!q) return null;
      if (q.status === 'answered' && q.answer) return q.answer;
      if (q.status !== 'pending') return null;

      await new Promise<void>((resolve) => setTimeout(resolve, ANSWER_POLL_MS));
    }

    questionManager.cancel(questionId);
    return null;
  },

  /**
   * Build a ClarificationContext after answers are collected.
   */
  buildContext(
    originalGoal:   string,
    questions:      ChatQuestion[],
  ): ClarificationContext {
    const clarifications = questions
      .filter((q) => q.status === 'answered' && q.answer)
      .map((q) => ({ question: q.text, answer: q.answer! }));

    const refinedGoal = clarifications.length > 0
      ? `${originalGoal}\n\nAdditional context:\n${clarifications.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join('\n')}`
      : originalGoal;

    return { originalGoal, clarifications, refinedGoal };
  },
};
