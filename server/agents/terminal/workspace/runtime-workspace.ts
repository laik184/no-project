import path from 'path';
import fs   from 'fs/promises';

const SANDBOX_BASE = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export interface WorkspaceInfo {
  projectId: string;
  root:      string;
  exists:    boolean;
}

export async function ensureWorkspace(projectId: string): Promise<string> {
  const root = path.resolve(SANDBOX_BASE, projectId);
  await fs.mkdir(root, { recursive: true });
  return root;
}

export async function getWorkspaceInfo(projectId: string): Promise<WorkspaceInfo> {
  const root = path.resolve(SANDBOX_BASE, projectId);
  let exists = false;
  try {
    await fs.access(root);
    exists = true;
  } catch { /* not found */ }
  return { projectId, root, exists };
}

export function getWorkspaceRoot(projectId: string): string {
  return path.resolve(SANDBOX_BASE, projectId);
}

export async function workspaceExists(projectId: string): Promise<boolean> {
  try {
    await fs.access(path.resolve(SANDBOX_BASE, projectId));
    return true;
  } catch {
    return false;
  }
}
