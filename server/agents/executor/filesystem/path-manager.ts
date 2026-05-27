import path from 'path';
import { workspaceManager } from '../sandbox/workspace-manager.ts';
import { hasTraversal, normalizePath } from '../utils/filesystem-utils.ts';

export const pathManager = {
  /** Resolve a relative file path within a project sandbox. Throws on traversal. */
  resolve(projectId: string, relativePath: string): string {
    if (hasTraversal(relativePath)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    return workspaceManager.resolvePath(projectId, relativePath);
  },

  /** Return the project's sandbox root directory. */
  root(projectId: string): string {
    return workspaceManager.getRoot(projectId);
  },

  /** Convert an absolute path to a project-relative path. */
  relative(projectId: string, absolutePath: string): string {
    const root = workspaceManager.getRoot(projectId);
    return normalizePath(path.relative(root, absolutePath));
  },

  /** Build a path for a source file, e.g. src/pages/Home.tsx */
  src(...segments: string[]): string {
    return path.join('src', ...segments);
  },

  /** Build a path for a server file, e.g. server/routes/user.ts */
  server(...segments: string[]): string {
    return path.join('server', ...segments);
  },

  /** Check whether a path would escape the sandbox. */
  isSafe(projectId: string, targetPath: string): boolean {
    return workspaceManager.isSafe(projectId, targetPath);
  },
};
