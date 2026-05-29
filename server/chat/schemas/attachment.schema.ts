import { z } from 'zod';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_RUN,
  ACCEPTED_IMAGE_MIME_TYPES,
  ACCEPTED_DOC_MIME_TYPES,
} from '../constants/chat.constants.ts';

export const ALL_ACCEPTED_MIME = [
  ...ACCEPTED_IMAGE_MIME_TYPES,
  ...ACCEPTED_DOC_MIME_TYPES,
] as const;

export const attachmentUploadSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  runId:     z.string().optional(),
});

export const attachmentQuerySchema = z.object({
  projectId: z.coerce.number().int().positive(),
  runId:     z.string().optional(),
});

export const attachmentConstraints = {
  maxBytes:        MAX_ATTACHMENT_BYTES,
  maxPerRun:       MAX_ATTACHMENTS_PER_RUN,
  acceptedMime:    ALL_ACCEPTED_MIME,
} as const;

export type AttachmentUploadInput = z.infer<typeof attachmentUploadSchema>;
export type AttachmentQueryInput  = z.infer<typeof attachmentQuerySchema>;
