import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_DIR, MAX_ATTACHMENTS_PER_RUN } from '../constants/chat.constants.ts';
import { validateAttachment } from './attachment-validator.ts';
import { attachmentStore }   from '../persistence/attachment-store.ts';
import type { AttachmentRecord } from '../persistence/attachment-store.ts';

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const uploadHandler = {
  async save(
    projectId:  number,
    filename:   string,
    mimeType:   string,
    buffer:     Buffer,
    runId?:     string,
  ): Promise<AttachmentRecord> {
    const validation = validateAttachment(mimeType, buffer.length);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    if (runId) {
      const count = await attachmentStore.countByRun(runId);
      if (count >= MAX_ATTACHMENTS_PER_RUN) {
        throw new Error(`Maximum ${MAX_ATTACHMENTS_PER_RUN} attachments per run`);
      }
    }

    ensureUploadDir();
    const ext        = path.extname(filename).toLowerCase();
    const storedName = `${crypto.randomUUID()}${ext}`;
    const storedPath = path.join(UPLOAD_DIR, storedName);
    fs.writeFileSync(storedPath, buffer);

    return attachmentStore.insert({
      projectId,
      runId,
      filename,
      mimeType,
      storedPath,
      sizeBytes: buffer.length,
    });
  },
};
