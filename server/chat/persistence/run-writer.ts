import { runRepository } from '../../repositories/chat/run.repository.ts';

export const runWriter = {
  async create(runId: string, projectId: number, goal: string): Promise<void> {
    await runRepository.create(runId, projectId, goal);
  },

  async setStatus(
    runId:   string,
    status:  'running' | 'completed' | 'failed' | 'cancelled',
    result?: unknown,
  ): Promise<void> {
    await runRepository.setStatus(runId, status, result);
  },
};
