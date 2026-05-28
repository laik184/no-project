/**
 * server/agents/terminal/workspace/runtime-workspace.ts
 *
 * Resolves the workspace root path for a given project.
 * Delegates sandbox path resolution — no direct filesystem access.
 *
 * Consumed by: server/agents/executor/step-runner.ts
 *   getWorkspaceRoot(projectId) → string
 */

import path from 'path';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

/**
 * Get the absolute sandbox root for a project.
 * This is the CWD used for all terminal and filesystem tool calls
 * within this project's execution context.
 */
export function getWorkspaceRoot(projectId: string): string {
  return path.resolve(path.join(SANDBOX_ROOT, projectId));
}

/**
 * Check whether a path is within the expected sandbox boundary.
 */
export function isWithinWorkspace(projectId: string, targetPath: string): boolean {
  const root     = getWorkspaceRoot(projectId);
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(root);
}

/**
 * Resolve a relative path within a project's workspace.
 */
export function resolveWorkspacePath(projectId: string, relativePath: string): string {
  const root = getWorkspaceRoot(projectId);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root)) {
    throw new Error(
      `[runtime-workspace] Path escape: "${relativePath}" resolves outside workspace`,
    );
  }
  return resolved;
}
