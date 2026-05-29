import { z } from 'zod';
import { QUESTION_TTL_MS } from '../constants/stream.constants.ts';

export const answerQuestionSchema = z.object({
  questionId: z.string().min(1),
  runId:      z.string().min(1),
  answer:     z.string().min(1, 'Answer cannot be empty'),
});

export const askQuestionSchema = z.object({
  runId:     z.string().min(1),
  projectId: z.number().int().positive(),
  kind:      z.enum(['clarification', 'ambiguity', 'confirmation']),
  text:      z.string().min(1).max(1000),
  options:   z.array(z.string().min(1)).min(1).max(10),
  ttlMs:     z.number().int().positive().max(30 * 60_000).default(QUESTION_TTL_MS),
});

export const questionIdParamSchema = z.object({
  questionId: z.string().min(1),
});

export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;
export type AskQuestionInput    = z.infer<typeof askQuestionSchema>;
