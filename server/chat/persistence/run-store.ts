import { runRepository } from '../../repositories/chat/run.repository.ts';
import type { ChatRun } from '../types/run.types.ts';

export const runStore = {
  async findById(runId: string): Promise<ChatRun | null> {
    return runRepository.findById(runId);
  },

  async findActiveByProject(projectId: number): Promise<ChatRun | null> {
    return runRepository.findActiveByProject(projectId);
  },

  async listByProject(projectId: number, limit = 20): Promise<ChatRun[]> {
    return runRepository.listByProject(projectId, limit);
  },

  async isActive(runId: string): Promise<boolean> {
    return runRepository.isActive(runId);
  },
};
