import { patchFile as _patchFile } from './files/patch-file.ts';
import { getWorkspaceRoot }        from '../terminal/workspace/runtime-workspace.ts';

export async function patchFile(
  projectId: string,
  relativePath: string,
  oldString: string,
  newString: string,
): Promise<{ ok: boolean; error?: string; replacements: number }> {
  const sandboxRoot = getWorkspaceRoot(projectId);
  try {
    const result = await _patchFile({ sandboxRoot, path: relativePath, oldString, newString });
    return { ok: true, replacements: result.occurrences };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), replacements: 0 };
  }
}
