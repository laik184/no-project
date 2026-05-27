import path from 'path';
import type { ToolExecutionContext } from '../../registry/tool-types.ts';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export function getSandboxRoot(): string {
  return path.resolve(SANDBOX_ROOT);
}

export function getProjectSandbox(projectId: string): string {
  return path.join(path.resolve(SANDBOX_ROOT), projectId);
}

export function resolveSandboxPath(context: ToolExecutionContext, relative = ''): string {
  const base = path.join(path.resolve(SANDBOX_ROOT), context.projectId);
  return relative ? path.join(base, relative) : base;
}

export function isSandboxSafe(context: ToolExecutionContext, targetPath: string): boolean {
  const sandboxRoot = path.join(path.resolve(SANDBOX_ROOT), context.projectId);
  const resolved    = path.resolve(targetPath);
  return resolved.startsWith(sandboxRoot);
}
