import { readFile as fsReadFile }   from '../../../tools/filesystem/lib/files/file-reader.ts';
import { readFolder as fsReadFolder } from '../../../tools/filesystem/lib/folders/folder-reader.ts';
import type { OperationRequest, OperationResult } from '../types/operation.types.ts';

export const readOperation = {
  async readFile(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    const content = await fsReadFile({ sandboxRoot, path: req.path });
    return { id: req.id, type: req.type, success: true, output: content, durationMs: 0 };
  },

  async readFolder(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    const entries = await fsReadFolder({ sandboxRoot, path: req.path });
    const listing = entries
      .map((e) => `${e.isDirectory ? 'd' : 'f'} ${e.relativePath}`)
      .join('\n');
    return { id: req.id, type: req.type, success: true, output: listing || '(empty)', durationMs: 0 };
  },
};
