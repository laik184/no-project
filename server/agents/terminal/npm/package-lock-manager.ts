import fs   from 'fs/promises';
import path  from 'path';
import { getWorkspaceRoot } from '../workspace/runtime-workspace.ts';

export interface LockfileStatus {
  exists:       boolean;
  lockfilePath: string;
  format:       'npm' | 'pnpm' | 'yarn' | 'unknown';
}

export async function getLockfileStatus(projectId: string): Promise<LockfileStatus> {
  const root = getWorkspaceRoot(projectId);

  const candidates: Array<{ file: string; format: LockfileStatus['format'] }> = [
    { file: 'package-lock.json', format: 'npm'  },
    { file: 'pnpm-lock.yaml',    format: 'pnpm' },
    { file: 'yarn.lock',         format: 'yarn' },
  ];

  for (const { file, format } of candidates) {
    const lockfilePath = path.join(root, file);
    try {
      await fs.access(lockfilePath);
      return { exists: true, lockfilePath, format };
    } catch { /* not found */ }
  }

  return { exists: false, lockfilePath: path.join(root, 'package-lock.json'), format: 'unknown' };
}

export async function deleteLockfile(projectId: string): Promise<boolean> {
  const status = await getLockfileStatus(projectId);
  if (!status.exists) return false;
  await fs.unlink(status.lockfilePath);
  return true;
}

export async function lockfileExists(projectId: string): Promise<boolean> {
  return (await getLockfileStatus(projectId)).exists;
}
