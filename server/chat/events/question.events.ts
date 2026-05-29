/**
 * question.events.ts — Question/answer event factories.
 */
import { CHAT_EVENT } from '../constants/event.constants.ts';
import type { ChatQuestion } from '../types/question.types.ts';

export interface QuestionAskedEvent {
  type:       typeof CHAT_EVENT.QUESTION_ASKED;
  questionId: string;
  runId:      string;
  projectId:  number;
  kind:       string;
  text:       string;
  options:    string[];
  ts:         number;
}

export interface QuestionAnsweredEvent {
  type:       typeof CHAT_EVENT.QUESTION_ANSWERED;
  questionId: string;
  runId:      string;
  projectId:  number;
  answer:     string;
  ts:         number;
}

export function makeQuestionAskedEvent(q: ChatQuestion): QuestionAskedEvent {
  return {
    type:       CHAT_EVENT.QUESTION_ASKED,
    questionId: q.questionId,
    runId:      q.runId,
    projectId:  q.projectId,
    kind:       q.kind,
    text:       q.text,
    options:    q.options,
    ts:         Date.now(),
  };
}

export function makeQuestionAnsweredEvent(
  questionId: string,
  runId:      string,
  projectId:  number,
  answer:     string,
): QuestionAnsweredEvent {
  return { type: CHAT_EVENT.QUESTION_ANSWERED, questionId, runId, projectId, answer, ts: Date.now() };
}
