/**
 * server/file-explorer/services/clone/clone.service.ts
 *
 * Tool-facing service for agent sandbox clone/copy operations.
 * Tool → cloneToolService → lib/files/file-cloner + lib/folders/folder-cloner (infra layer)
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

class CloneToolService {
  cloneFile(opts: CloneOptions): Promise<CloneResult>             { return cloneFile(opts); }
  cloneFolder(opts: CloneFolderOptions): Promise<CloneFolderResult> { return cloneFolder(opts); }
}

export const cloneToolService = new CloneToolService();
