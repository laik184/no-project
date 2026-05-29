/**
 * server/infrastructure/sandbox/sandbox.util.ts
 *
 * Sandbox path utilities.
 * Provides canonical project directory resolution.
 */
import path from 'path';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? path.join(process.cwd(), '.sandbox');

/**
 * Returns the canonical directory for a project's sandbox workspace.
 * @param projectId - numeric project id
 */
export function getProjectDir(projectId: number | string): string {
  return path.join(SANDBOX_ROOT, String(projectId));
}

/**
 * Returns the .nura metadata directory inside the project sandbox.
 */
export function getNuraDir(projectId: number | string): string {
  return path.join(getProjectDir(projectId), '.nura');
}
