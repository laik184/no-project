import type { FilesystemAgentState } from '../types/filesystem.types.ts';
import { workspaceManager }          from '../../../tools/filesystem/lib/workspace/workspace-manager.ts';
import { isolationManager }          from '../../../tools/filesystem/lib/workspace/isolation-manager.ts';

export interface FilesystemContext {
  state:       FilesystemAgentState;
  sandboxRoot: string;
}

export async function createFilesystemContext(
  runId: string,
  projectId: string,
): Promise<FilesystemContext> {
  const sandboxRoot = await workspaceManager.init(projectId, runId);
  isolationManager.create(projectId, runId, sandboxRoot);

  const state: FilesystemAgentState = {
    runId,
    projectId,
    sandboxRoot,
    opsCompleted: 0,
    opsFailed:    0,
    startedAt:    new Date(),
  };

  return { state, sandboxRoot };
}

export function releaseFilesystemContext(runId: string, projectId: string): void {
  const ctx = isolationManager.get(projectId, runId);
  if (ctx) isolationManager.release(ctx.contextId);
}
