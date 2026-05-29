/**
 * attachment-manager.ts — Coordinates attachment upload pipeline.
 * Owns: validate → store → persist → publish event.
 */
import { validateAttachment, sanitizeFilename } from './attachment-validator.ts';
import { storeUpload }        from './upload-handler.ts';
import { extractImageMetadata } from './image-processor.ts';
import { processFileAttachment } from './file-processor.ts';
import { attachmentStore }    from '../persistence/attachment-store.ts';
import { eventPublisher }     from '../realtime/event-publisher.ts';
import { CHAT_EVENT }         from '../constants/event.constants.ts';
import { MAX_ATTACHMENTS_PER_RUN } from '../constants/chat.constants.ts';
import type { AttachmentRecord } from '../persistence/attachment-store.ts';
import { ACCEPTED_IMAGE_MIME_TYPES } from '../constants/chat.constants.ts';

export class AttachmentError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AttachmentError';
  }
}

export interface UploadInput {
  projectId: number;
  runId?:    string;
  filename:  string;
  mimeType:  string;
  data:      Buffer;
}

export const attachmentManager = {
  async upload(input: UploadInput): Promise<AttachmentRecord> {
    const { projectId, runId, data } = input;
    const filename  = sanitizeFilename(input.filename);
    const mimeType  = input.mimeType;

    // 1. Validate
    const validation = validateAttachment(filename, mimeType, data.length);
    if (!validation.valid) {
      throw new AttachmentError(validation.errors.join('; '), 'VALIDATION_FAILED');
    }

    // 2. Check per-run limit
    if (runId) {
      const count = await attachmentStore.countByRun(runId);
      if (count >= MAX_ATTACHMENTS_PER_RUN) {
        throw new AttachmentError(
          `Maximum ${MAX_ATTACHMENTS_PER_RUN} attachments per run reached`,
          'LIMIT_EXCEEDED',
        );
      }
    }

    // 3. Process (extract metadata / text)
    const accepted = ACCEPTED_IMAGE_MIME_TYPES as readonly string[];
    if (accepted.includes(mimeType)) {
      extractImageMetadata(data, mimeType); // validates magic bytes (non-throwing)
    } else {
      processFileAttachment(filename, mimeType, data); // extracts text for context
    }

    // 4. Store to disk
    const stored = await storeUpload(filename, mimeType, data);

    // 5. Persist to DB
    const record = await attachmentStore.insert({
      projectId,
      runId,
      filename:   stored.filename,
      mimeType:   stored.mimeType,
      storedPath: stored.storedPath,
      sizeBytes:  stored.sizeBytes,
    });

    // 6. Publish event
    eventPublisher.publish({
      type:         CHAT_EVENT.ATTACHMENT_UPLOADED,
      projectId,
      runId,
      attachmentId: record.id,
      filename:     record.filename,
      mimeType:     record.mimeType,
      sizeBytes:    record.sizeBytes,
      ts:           Date.now(),
    });

    return record;
  },

  async listByProject(projectId: number): Promise<AttachmentRecord[]> {
    return attachmentStore.listByProject(projectId);
  },

  async listByRun(runId: string): Promise<AttachmentRecord[]> {
    return attachmentStore.listByRun(runId);
  },
};
