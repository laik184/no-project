import { existsSync, statSync } from 'fs';
import path from 'path';
import { getSandboxRoot } from '../validation/sandbox-validator.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';

export interface LockfileStatus {
  exists:    boolean;
  type:      'package-lock' | 'yarn.lock' | 'pnpm-lock' | 'none';
  sizeBytes: number;
  path:      string;
}

export function getLockfileStatus(projectId: string): LockfileStatus {
  const root = getSandboxRoot(projectId);
  for (const [file, type] of [
    ['package-lock.json', 'package-lock'],
    ['yarn.lock',         'yarn.lock'],
    ['pnpm-lock.yaml',    'pnpm-lock'],
  ] as const) {
    const p = path.join(root, file);
    if (existsSync(p)) {
      return { exists: true, type, sizeBytes: statSync(p).size, path: p };
    }
  }
  return { exists: false, type: 'none', sizeBytes: 0, path: root };
}

export const lockfileStatusTool: ToolDefinition = {
  name: 'lockfile_status', category: 'terminal',
  description: 'Check lockfile status in a project sandbox',
  inputSchema: { projectId: { type: 'string', description: 'Project ID', required: true } },
  permissions: ['read'], timeoutMs: 2_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input: Record<string, unknown>) => getLockfileStatus(input.projectId as string),
};
