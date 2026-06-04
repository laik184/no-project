import { z } from 'zod';
import { MAX_MESSAGE_LENGTH } from '../constants/chat.constants.ts';

export const sendMessageSchema = z.object({
  projectId: z.number().int().positive(),
  content:   z.string().min(1).max(MAX_MESSAGE_LENGTH),
  runId:     z.string().optional(),
});

export const feedbackSchema = z.object({
  feedback: z.enum(['up', 'down']),
});

export const startRunSchema = z.object({
  projectId:      z.number().int().positive(),
  goal:           z.string().min(1).max(MAX_MESSAGE_LENGTH),
  mode:           z.enum(['planned', 'direct', 'auto']).optional(),
  conversationId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type FeedbackInput    = z.infer<typeof feedbackSchema>;
export type StartRunInput    = z.infer<typeof startRunSchema>;
