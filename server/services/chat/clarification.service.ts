/**
 * server/services/chat/clarification.service.ts
 *
 * Ambiguity detection and clarification Q&A workflow.
 *
 * Owns: detect ambiguity, ask questions, wait for answers, refine goal.
 */

import { analyzeAmbiguity, buildClarificationText } from '../../chat/questions/ambiguity-detector.ts';
import { questionManager }       from '../../chat/questions/question-manager.ts';
import { eventPublisher }        from '../../chat/realtime/event-publisher.ts';
import { makeQuestionAskedEvent } from '../../chat/events/question.events.ts';
import {
  ANSWER_POLL_MS,
  ANSWER_WAIT_TIMEOUT_MS,
} from '../../chat/constants/stream.constants.ts';

export interface ClarificationInput {
  goal:      string;
  runId:     string;
  projectId: number;
}

export const clarificationManager = {
  /**
   * Check if a goal is ambiguous.
   * Returns detected ambiguities, or empty array if clear.
   */
  check(goal: string): string[] {
    const analysis = analyzeAmbiguity(goal);
    return analysis.isAmbiguous ? analysis.ambiguities : [];
  },

  /**
   * Full clarification workflow:
   * 1. Analyze goal for ambiguity
   * 2. If ambiguous, ask a question via SSE and poll for answer
   * 3. Return refined goal string
   *
   * If no ambiguity or no answer within timeout, returns original goal.
   */
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
