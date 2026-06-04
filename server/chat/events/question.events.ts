import type { ChatQuestion } from '../types/question.types.ts';

export interface QuestionAskedEvent {
  eventType: string;
  type:      string;
  questionId: string;
  runId:      string;
  projectId:  number;
  kind:       string;
  text:       string;
  options:    string[];
  ts:         number;
}

export interface QuestionAnsweredEvent {
  eventType:  string;
  type:       string;
  questionId: string;
  runId:      string;
  projectId:  number;
  answer:     string;
  ts:         number;
}

export function makeQuestionAskedEvent(question: ChatQuestion): QuestionAskedEvent {
  return {
    eventType:  'chat.question.asked',
    type:       'chat.question.asked',
    questionId: question.questionId,
    runId:      question.runId,
    projectId:  question.projectId,
    kind:       question.kind,
    text:       question.text,
    options:    question.options,
    ts:         Date.now(),
  };
}

export function makeQuestionAnsweredEvent(
  questionId: string,
  runId:      string,
  projectId:  number,
  answer:     string,
): QuestionAnsweredEvent {
  return {
    eventType:  'chat.question.answered',
    type:       'chat.question.answered',
    questionId,
    runId,
    projectId,
    answer,
    ts: Date.now(),
  };
}
