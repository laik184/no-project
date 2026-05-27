import { writeFile }  from './files/file-writer.ts';
import { getWorkspaceRoot } from '../terminal/workspace/runtime-workspace.ts';

export const fileWriter = {
  async write(projectId: string, relativePath: string, content: string): Promise<void> {
    const sandboxRoot = getWorkspaceRoot(projectId);
    await writeFile({ sandboxRoot, path: relativePath, content, overwrite: true });
  },
};
