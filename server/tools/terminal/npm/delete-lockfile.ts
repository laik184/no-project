import { unlinkSync, existsSync } from 'fs';
import path from 'path';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export function deleteLockfile(projectId: string): boolean {
  const root = getSandboxRoot(projectId);
  for (const file of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
    const p = path.join(root, file);
    if (existsSync(p)) { unlinkSync(p); return true; }
  }
  return false;
}

export const deleteLockfileTool: ToolDefinition = {
  name: 'delete_lockfile', category: 'terminal',
  description: 'Delete lockfile from a project sandbox',
  inputSchema: { projectId: { type: 'string', description: 'Project ID', required: true } },
  permissions: ['write'], timeoutMs: 2_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => ({ deleted: deleteLockfile(input.projectId as string) }),
};
