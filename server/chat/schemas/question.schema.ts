import { z } from 'zod';

export const answerSchema = z.object({
  answer: z.string().min(1),
  runId:  z.string().min(1),
});

export const questionIdParamSchema = z.object({
  questionId: z.string().min(1),
});

export const runIdParamSchema = z.object({
  runId: z.string().min(1),
});

export type AnswerInput          = z.infer<typeof answerSchema>;
export type QuestionIdParamInput = z.infer<typeof questionIdParamSchema>;
