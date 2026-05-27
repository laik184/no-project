import { getWorkspaceRoot, ensureWorkspace } from './runtime-workspace.ts';
import { assertCwdSafe } from '../security/sandbox-guard.ts';

export interface ResolvedWorkspace {
  projectId: string;
  root:      string;
  cwd:       string;
}

export async function resolveWorkspace(
  projectId: string,
  relativeCwd?: string,
): Promise<ResolvedWorkspace> {
  const root = await ensureWorkspace(projectId);
  const cwd  = relativeCwd ? `${root}/${relativeCwd}` : root;

  assertCwdSafe(projectId, cwd);

  return { projectId, root, cwd };
}

export function resolveWorkspaceSync(projectId: string): string {
  return getWorkspaceRoot(projectId);
}

export async function assertWorkspaceReady(projectId: string): Promise<string> {
  const root = await ensureWorkspace(projectId);
  assertCwdSafe(projectId, root);
  return root;
}
