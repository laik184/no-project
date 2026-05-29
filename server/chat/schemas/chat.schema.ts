import { z } from 'zod';
import { MAX_MESSAGE_LENGTH, MAX_TITLE_LENGTH, DEFAULT_RUN_MODE } from '../constants/chat.constants.ts';

export const runModeSchema = z.enum(['planned', 'tool-loop']).default(DEFAULT_RUN_MODE);

export const startRunSchema = z.object({
  projectId:       z.number().int().positive(),
  goal:            z.string().min(1, 'Goal is required').max(MAX_MESSAGE_LENGTH),
  mode:            runModeSchema.optional(),
  conversationId:  z.string().uuid().optional(),
  context:         z.record(z.unknown()).optional(),
});

export const sendMessageSchema = z.object({
  projectId: z.number().int().positive(),
  content:   z.string().min(1).max(MAX_MESSAGE_LENGTH),
  runId:     z.string().optional(),
});

export const conversationTitleSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
});

export const historyQuerySchema = z.object({
  projectId: z.coerce.number().int().positive(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  status:    z.enum(['active', 'archived', 'deleted']).optional(),
});

export const feedbackSchema = z.object({
  messageId: z.number().int().positive(),
  feedback:  z.enum(['up', 'down']),
});

export type StartRunInput     = z.infer<typeof startRunSchema>;
export type SendMessageInput  = z.infer<typeof sendMessageSchema>;
export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
export type FeedbackInput     = z.infer<typeof feedbackSchema>;
