import { WorkspaceManager } from './workspace/workspace-manager.ts';

const _wm = new WorkspaceManager();

export const workspaceManager = {
  async init(projectId: string, _runId: string): Promise<string> {
    const info = await _wm.create(projectId);
    return info.root;
  },

  getRoot(projectId: string): string {
    return _wm.getRoot(projectId);
  },

  async exists(projectId: string): Promise<boolean> {
    return _wm.exists(projectId);
  },
};
