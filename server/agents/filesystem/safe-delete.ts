import { deleteFileFromSandbox } from './files/file-deleter.ts';
import { getWorkspaceRoot }       from '../terminal/workspace/runtime-workspace.ts';

export async function safeDelete(
  projectId: string,
  relativePath: string,
): Promise<{ ok: boolean; error?: string }> {
  const sandboxRoot = getWorkspaceRoot(projectId);
  try {
    await deleteFileFromSandbox({ sandboxRoot, path: relativePath, mustExist: false });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
