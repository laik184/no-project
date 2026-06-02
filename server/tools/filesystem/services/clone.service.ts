/**
 * server/tools/filesystem/services/clone.service.ts
 *
 * Service layer for all clone/copy operations on the agent sandbox.
 * Tool → CloneService → lib/files/file-cloner + lib/folders/folder-cloner (repository/infra layer)
 *
 * No tool may import lib/files/file-cloner.ts or lib/folders/folder-cloner.ts directly.
 */

import {
  cloneFile,
  type CloneOptions,
  type CloneResult,
} from '../lib/files/file-cloner.ts';

import {
  cloneFolder,
  type CloneFolderOptions,
  type CloneFolderResult,
} from '../lib/folders/folder-cloner.ts';

export type { CloneOptions, CloneResult, CloneFolderOptions, CloneFolderResult };

class CloneService {
  cloneFile(opts: CloneOptions): Promise<CloneResult> {
    return cloneFile(opts);
  }

  cloneFolder(opts: CloneFolderOptions): Promise<CloneFolderResult> {
    return cloneFolder(opts);
  }
}

export const cloneToolService = new CloneService();
