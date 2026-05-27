import path from 'path';
import { SandboxViolationError } from '../shared/terminal-errors.ts';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export function assertSandboxPath(projectId: string, targetPath: string): void {
  const root     = path.resolve(path.join(SANDBOX_ROOT, projectId));
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(root)) throw new SandboxViolationError(targetPath);
}

export function isSandboxSafe(projectId: string, targetPath: string): boolean {
  const root     = path.resolve(path.join(SANDBOX_ROOT, projectId));
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(root);
}

export function getSandboxRoot(projectId: string): string {
  return path.resolve(path.join(SANDBOX_ROOT, projectId));
}
