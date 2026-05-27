import path from 'path';
import { isSafePath } from '../../../../server/infrastructure/sandbox/sandbox.util.ts';

const SANDBOX_BASE = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export class SandboxEscapeError extends Error {
  constructor(attempted: string, root: string) {
    super(`[sandbox-guard] Path escapes sandbox. Attempted: "${attempted}", Root: "${root}"`);
    this.name = 'SandboxEscapeError';
  }
}

export function getSandboxRoot(projectId: string): string {
  return path.resolve(SANDBOX_BASE, projectId);
}

export function assertWithinSandbox(projectId: string, targetPath: string): string {
  const root = getSandboxRoot(projectId);
  const abs  = path.resolve(root, targetPath);
  if (!isSafePath(root, abs)) {
    throw new SandboxEscapeError(targetPath, root);
  }
  return abs;
}

export function isCwdSafe(projectId: string, cwd: string): boolean {
  const root = getSandboxRoot(projectId);
  const abs  = path.resolve(cwd);
  return abs.startsWith(path.resolve(root));
}

export function assertCwdSafe(projectId: string, cwd: string): void {
  if (!isCwdSafe(projectId, cwd)) {
    throw new SandboxEscapeError(cwd, getSandboxRoot(projectId));
  }
}
