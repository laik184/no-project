/**
 * server/file-explorer/services/delete.service.ts
 *
 * Service layer for all delete operations on the agent sandbox.
 * Tool → DeleteService → lib/files/file-deleter + lib/folders/folder-deleter (repository/infra layer)
 *
 * No tool may import lib/files/file-deleter.ts or lib/folders/folder-deleter.ts directly.
 */

import {
  deleteFileFromSandbox,
  deleteMultipleFiles,
  type DeleteOptions,
  type DeleteResult,
} from '../../tools/filesystem/lib/files/file-deleter.ts';

import {
  deleteFolder,
  type DeleteFolderOptions,
  type DeleteFolderResult,
} from '../../tools/filesystem/lib/folders/folder-deleter.ts';

export type { DeleteOptions, DeleteResult, DeleteFolderOptions, DeleteFolderResult };

class DeleteService {
  deleteFile(opts: DeleteOptions): Promise<DeleteResult> {
    return deleteFileFromSandbox(opts);
  }

  deleteFiles(sandboxRoot: string, paths: string[]): Promise<DeleteResult[]> {
    return deleteMultipleFiles(sandboxRoot, paths);
  }

  deleteFolder(opts: DeleteFolderOptions): Promise<DeleteFolderResult> {
    return deleteFolder(opts);
  }
}

export const deleteToolService = new DeleteService();
