import type { FilesystemContext } from './filesystem-context.ts';
import type { OperationRecord }   from '../types/filesystem.types.ts';

interface Session {
  ctx:  FilesystemContext;
  history: OperationRecord[];
}

const sessions = new Map<string, Session>();

export const filesystemSession = {
  set(runId: string, ctx: FilesystemContext): void {
    sessions.set(runId, { ctx, history: [] });
  },

  get(runId: string): Session | undefined {
    return sessions.get(runId);
  },

  pushRecord(runId: string, record: OperationRecord): void {
    sessions.get(runId)?.history.push(record);
  },

  delete(runId: string): void {
    sessions.delete(runId);
  },

  has(runId: string): boolean {
    return sessions.has(runId);
  },
};
