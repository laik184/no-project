import { readFile }  from './files/file-reader.ts';
import { getWorkspaceRoot } from '../terminal/workspace/runtime-workspace.ts';

export const fileReader = {
  async read(projectId: string, relativePath: string): Promise<string> {
    const sandboxRoot = getWorkspaceRoot(projectId);
    return readFile({ sandboxRoot, path: relativePath });
  },
};
