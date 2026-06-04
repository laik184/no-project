import { z } from 'zod';

export const uploadSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  runId:     z.string().optional(),
});

export const attachmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type UploadInput          = z.infer<typeof uploadSchema>;
export type AttachmentIdInput    = z.infer<typeof attachmentIdParamSchema>;
