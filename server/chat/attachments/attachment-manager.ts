import { uploadHandler }     from './upload-handler.ts';
import { getSafeFilename }   from './file-processor.ts';
import { attachmentStore }   from '../persistence/attachment-store.ts';
import { eventPublisher }    from '../realtime/event-publisher.ts';
import { CHAT_EVENT }        from '../constants/event.constants.ts';
import type { AttachmentRecord } from '../persistence/attachment-store.ts';

export const attachmentManager = {
  async upload(
    projectId: number,
    filename:  string,
    mimeType:  string,
    buffer:    Buffer,
    runId?:    string,
  ): Promise<AttachmentRecord> {
    const safeName = getSafeFilename(filename);
    const record   = await uploadHandler.save(projectId, safeName, mimeType, buffer, runId);

    eventPublisher.publish({
      eventType:    CHAT_EVENT.ATTACHMENT_UPLOADED,
      projectId,
      runId,
      attachmentId: record.id,
      filename:     safeName,
      ts:           Date.now(),
    });

    return record;
  },

  async listByRun(runId: string): Promise<AttachmentRecord[]> {
    return attachmentStore.listByRun(runId);
  },

  async listByProject(projectId: number): Promise<AttachmentRecord[]> {
    return attachmentStore.listByProject(projectId);
  },
};
