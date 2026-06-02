/**
 * server/tools/filesystem/services/folder.service.ts
 *
 * Service layer for all folder read/create operations on the agent sandbox.
 * Tool → FolderService → lib/folders/{folder-reader,folder-creator} (repository/infra layer)
 *
 * No tool may import those lib files directly.
 */

import {
  readFolder,
  readFolderNames,
  readFileEntries,
  readSubfolderEntries,
  type ReadFolderOptions,
  type FolderEntry,
} from '../lib/folders/folder-reader.ts';

import {
  createFolder,
  createFolders,
  type CreateFolderOptions,
  type CreateFolderResult,
} from '../lib/folders/folder-creator.ts';

export type { ReadFolderOptions, FolderEntry, CreateFolderOptions, CreateFolderResult };

class FolderService {
  readFolder(opts: ReadFolderOptions): Promise<FolderEntry[]> {
    return readFolder(opts);
  }

  readFolderNames(opts: ReadFolderOptions): Promise<string[]> {
    return readFolderNames(opts);
  }

  readFileEntries(opts: ReadFolderOptions): Promise<FolderEntry[]> {
    return readFileEntries(opts);
  }

  readSubfolderEntries(opts: ReadFolderOptions): Promise<FolderEntry[]> {
    return readSubfolderEntries(opts);
  }

  createFolder(opts: CreateFolderOptions): Promise<CreateFolderResult> {
    return createFolder(opts);
  }

  createFolders(sandboxRoot: string, paths: string[]): Promise<CreateFolderResult[]> {
    return createFolders(sandboxRoot, paths);
  }
}

export const folderToolService = new FolderService();
