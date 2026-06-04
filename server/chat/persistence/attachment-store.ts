import { attachmentRepository } from '../../repositories/chat/attachment.repository.ts';
import type { AttachmentRecord } from '../../repositories/chat/attachment.repository.ts';

export type { AttachmentRecord };

export const attachmentStore = {
  async insert(data: Omit<AttachmentRecord, 'id' | 'createdAt'>): Promise<AttachmentRecord> {
    return attachmentRepository.insert(data);
  },

  async listByProject(projectId: number): Promise<AttachmentRecord[]> {
    return attachmentRepository.listByProject(projectId);
  },

  async listByRun(runId: string): Promise<AttachmentRecord[]> {
    return attachmentRepository.listByRun(runId);
  },

  async findById(id: number): Promise<AttachmentRecord | null> {
    return attachmentRepository.findById(id);
  },

  async countByRun(runId: string): Promise<number> {
    return attachmentRepository.countByRun(runId);
  },
};
