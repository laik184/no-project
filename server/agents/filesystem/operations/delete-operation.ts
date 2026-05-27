import { deleteFileFromSandbox } from '../../../tools/filesystem/lib/files/file-deleter.ts';
import { deleteFolder as fsDeleteFolder } from '../../../tools/filesystem/lib/folders/folder-deleter.ts';
import { emitFileChanged }       from '../events/filesystem-events.ts';
import type { OperationRequest, OperationResult } from '../types/operation.types.ts';

export const deleteOperation = {
  async deleteFile(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    const result = await deleteFileFromSandbox({ sandboxRoot, path: req.path });
    if (result.deleted) {
      emitFileChanged({ runId: req.runId, projectId: req.projectId, path: req.path, changeType: 'deleted' });
    }
    return {
      id: req.id, type: req.type,
      success: result.deleted,
      output:  result.deleted ? `Deleted: ${req.path}` : undefined,
      error:   result.deleted ? undefined : `Not found: ${req.path}`,
      durationMs: 0,
    };
  },

  async deleteFolder(req: OperationRequest, sandboxRoot: string): Promise<OperationResult> {
    const result = await fsDeleteFolder({ sandboxRoot, path: req.path });
    if (result.deleted) {
      emitFileChanged({ runId: req.runId, projectId: req.projectId, path: req.path, changeType: 'deleted' });
    }
    return {
      id: req.id, type: req.type,
      success: result.deleted,
      output:  result.deleted ? `Deleted folder: ${req.path}` : undefined,
      error:   result.deleted ? undefined : `Not found: ${req.path}`,
      durationMs: 0,
    };
  },
};
