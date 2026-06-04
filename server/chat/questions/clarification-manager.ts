/**
 * server/chat/questions/clarification-manager.ts
 *
 * Ambiguity detection and clarification Q&A workflow (Chat layer).
 * Moved from server/services/chat/clarification.service.ts so that
 * it can legitimately import questionManager, eventPublisher, and
 * other Chat-layer primitives without violating the dependency rules.
 */

import { analyzeAmbiguity, buildClarificationText } from './ambiguity-detector.ts';
import { questionManager }                           from './question-manager.ts';
import { eventPublisher }                            from '../realtime/event-publisher.ts';
import { makeQuestionAskedEvent }                    from '../events/question.events.ts';
import {
  ANSWER_POLL_MS,
  ANSWER_WAIT_TIMEOUT_MS,
}                                                    from '../constants/stream.constants.ts';

export interface ClarificationInput {
  goal:      string;
  runId:     string;
  projectId: number;
}

export const clarificationManager = {
  check(goal: string): string[] {
    const analysis = analyzeAmbiguity(goal);
    return analysis.isAmbiguous ? analysis.ambiguities : [];
  },

  async run(input: ClarificationInput): Promise<string> {
    const analysis = analyzeAmbiguity(input.goal);
    if (!analysis.isAmbiguous) return input.goal;

    const text    = buildClarificationText(analysis.ambiguities);
    const options = analysis.ambiguities.slice(0, 4);

    const question = questionManager.create({
      runId:     input.runId,
      projectId: input.projectId,
      kind:      'clarification',
      text,
      options,
    });

    eventPublisher.publish(makeQuestionAskedEvent(question));

    const deadline = Date.now() + ANSWER_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise<void>((r) => setTimeout(r, ANSWER_POLL_MS));
      const q = questionManager.get(question.questionId);
      if (!q || q.status === 'expired' || q.status === 'cancelled') break;
      if (q.status === 'answered' && q.answer) {
        return `${input.goal} [clarified: ${q.answer}]`;
      }
    }

    return input.goal;
  },
};

export const clarificationService = clarificationManager;
