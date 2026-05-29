import { z } from 'zod';

export const cancelRunSchema = z.object({
  runId: z.string().min(1),
});

export const runIdParamSchema = z.object({
  runId: z.string().min(1),
});

export const runStatusQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
});

export const runContextSchema = z.object({
  maxSteps:         z.number().int().positive().max(100).optional(),
  maxContinuations: z.number().int().positive().max(10).optional(),
  timeoutMs:        z.number().int().positive().max(600_000).optional(),
});

export type CancelRunInput     = z.infer<typeof cancelRunSchema>;
export type RunIdParamInput    = z.infer<typeof runIdParamSchema>;
export type RunContextInput    = z.infer<typeof runContextSchema>;
