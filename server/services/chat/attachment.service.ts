/**
 * server/services/chat/attachment.service.ts
 *
 * Service facade for attachment operations.
 * Controllers must call this service — never the persistence store or
 * attachment manager directly.
 */

import { attachmentStore }   from '../../chat/persistence/attachment-store.ts';
import { attachmentManager } from '../../chat/attachments/attachment-manager.ts';
import type { AttachmentRecord } from '../../chat/persistence/attachment-store.ts';

export const attachmentService = {
  async listByProject(projectId: number): Promise<AttachmentRecord[]> {
    return attachmentStore.listByProject(projectId);
  },

  async listByRun(runId: string): Promise<AttachmentRecord[]> {
    return attachmentStore.listByRun(runId);
  },

  async findById(id: number): Promise<AttachmentRecord | null> {
    return attachmentStore.findById(id);
  },

  async upload(
    projectId: number,
    filename:  string,
    mimeType:  string,
    buffer:    Buffer,
    runId?:    string,
  ): Promise<AttachmentRecord> {
    return attachmentManager.upload(projectId, filename, mimeType, buffer, runId);
  },
};
