/**
 * server/file-explorer/services/delete/tool.service.ts
 *
 * Tool-facing service for agent sandbox delete operations.
 * Tool → deleteToolService → lib/files/file-deleter + lib/folders/folder-deleter (infra layer)
 */

import {
  deleteFileFromSandbox,
  deleteMultipleFiles,
  type DeleteOptions,
  type DeleteResult,
} from '../../../../tools/filesystem/lib/files/file-deleter.ts';

import {
  deleteFolder,
  type DeleteFolderOptions,
  type DeleteFolderResult,
} from '../../../../tools/filesystem/lib/folders/folder-deleter.ts';

export type { DeleteOptions, DeleteResult, DeleteFolderOptions, DeleteFolderResult };

class DeleteToolService {
  deleteFile(opts: DeleteOptions): Promise<DeleteResult>               { return deleteFileFromSandbox(opts); }
  deleteFiles(sandboxRoot: string, paths: string[]): Promise<DeleteResult[]> { return deleteMultipleFiles(sandboxRoot, paths); }
  deleteFolder(opts: DeleteFolderOptions): Promise<DeleteFolderResult> { return deleteFolder(opts); }
}

export const deleteToolService = new DeleteToolService();
