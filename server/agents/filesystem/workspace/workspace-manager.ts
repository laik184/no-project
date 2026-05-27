import { promises as fs } from 'node:fs';
import { resolvePath, joinPath } from '../utils/path-utils.ts';
import { ensureDir, fileExists, isDirectory, deleteDir } from '../utils/filesystem-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';

export class WorkspaceError extends Error {
  constructor(message: string, public readonly workspaceId: string) {
    super(`[workspace-manager] ${message} (workspace: "${workspaceId}")`);
    this.name = 'WorkspaceError';
  }
}

export interface WorkspaceInfo {
  id: string;
  root: string;
  createdAt: Date;
  exists: boolean;
}

const SANDBOX_BASE = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export class WorkspaceManager {
  private readonly base: string;

  constructor(baseDir: string = SANDBOX_BASE) {
    this.base = resolvePath(baseDir);
  }

  getRoot(workspaceId: string): string {
    return joinPath(this.base, workspaceId);
  }

  async create(workspaceId: string): Promise<WorkspaceInfo> {
    const root = this.getRoot(workspaceId);
    await ensureDir(root);
    const stat = await fs.stat(root);
    return { id: workspaceId, root, createdAt: stat.birthtime, exists: true };
  }

  async exists(workspaceId: string): Promise<boolean> {
    const root = this.getRoot(workspaceId);
    return isDirectory(root);
  }

  async info(workspaceId: string): Promise<WorkspaceInfo> {
    const root = this.getRoot(workspaceId);
    const exists = await isDirectory(root);
    if (!exists) return { id: workspaceId, root, createdAt: new Date(0), exists: false };
    const stat = await fs.stat(root);
    return { id: workspaceId, root, createdAt: stat.birthtime, exists: true };
  }

  resolvePath(workspaceId: string, relativePath: string): string {
    const root = this.getRoot(workspaceId);
    return assertSandboxPath(root, relativePath);
  }

  async cleanup(workspaceId: string): Promise<void> {
    const root = this.getRoot(workspaceId);
    if (await isDirectory(root)) {
      await deleteDir(root);
    }
  }

  async list(): Promise<string[]> {
    if (!(await fileExists(this.base))) return [];
    const entries = await fs.readdir(this.base, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  }

  async assertExists(workspaceId: string): Promise<string> {
    const root = this.getRoot(workspaceId);
    if (!(await isDirectory(root))) {
      throw new WorkspaceError(`Workspace does not exist`, workspaceId);
    }
    return root;
  }
}

export const workspaceManager = new WorkspaceManager();
