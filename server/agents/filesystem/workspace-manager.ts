import path from 'path';
import fs from 'fs/promises';
import {
  getProjectDir,
  ensureProjectDir,
  resolveInSandbox,
  isSafePath,
} from '../../infrastructure/sandbox/sandbox.util.ts';
import { validateSandboxPath } from './sandbox-validator.ts';
import { executorLogger } from '../executor/telemetry/executor-logger.ts';

export interface WorkspaceInfo {
  projectId: string;
  rootPath:  string;
  exists:    boolean;
}

export const workspaceManager = {
  async init(projectId: string, runId: string): Promise<string> {
    const dir = await ensureProjectDir(Number(projectId));
    executorLogger.info(runId, `Workspace initialized at ${dir}`);
    return dir;
  },

  getRoot(projectId: string): string {
    return getProjectDir(Number(projectId));
  },

  resolvePath(projectId: string, relativePath: string): string {
    return resolveInSandbox(Number(projectId), relativePath);
  },

  isSafe(projectId: string, filePath: string): boolean {
    const root = getProjectDir(Number(projectId));
    return isSafePath(root, filePath);
  },

  validatePath(projectId: string, targetPath: string): { safe: boolean; reason: string } {
    const root = getProjectDir(Number(projectId));
    return validateSandboxPath(root, targetPath);
  },

  async ensureDir(projectId: string, relativePath: string): Promise<void> {
    const root  = getProjectDir(Number(projectId));
    const check = validateSandboxPath(root, relativePath);
    if (!check.safe) throw new Error(`Unsafe path: ${check.reason}`);

    const abs = path.join(root, relativePath);
    await fs.mkdir(abs, { recursive: true });
  },

  async exists(projectId: string, relativePath: string): Promise<boolean> {
    try {
      const abs = resolveInSandbox(Number(projectId), relativePath);
      await fs.access(abs);
      return true;
    } catch {
      return false;
    }
  },

  async info(projectId: string): Promise<WorkspaceInfo> {
    const rootPath = getProjectDir(Number(projectId));
    let exists = false;
    try {
      await fs.access(rootPath);
      exists = true;
    } catch { /* not yet created */ }
    return { projectId, rootPath, exists };
  },
};
