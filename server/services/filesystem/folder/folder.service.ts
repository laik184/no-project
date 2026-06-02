/**
 * server/file-explorer/services/folder/folder.service.ts
 *
 * Tool-facing service for agent sandbox folder read/create operations.
 * Tool → folderToolService → lib/folders/{folder-reader,folder-creator} (infra layer)
 */

import {
  readFolder,
  readFolderNames,
  readFileEntries,
  readSubfolderEntries,
  type ReadFolderOptions,
  type FolderEntry,
} from '../../../tools/filesystem/lib/folders/folder-reader.ts';

import {
  createFolder,
  createFolders,
  type CreateFolderOptions,
  type CreateFolderResult,
} from '../../../tools/filesystem/lib/folders/folder-creator.ts';

export type { ReadFolderOptions, FolderEntry, CreateFolderOptions, CreateFolderResult };

class FolderToolService {
  readFolder(opts: ReadFolderOptions): Promise<FolderEntry[]>             { return readFolder(opts); }
  readFolderNames(opts: ReadFolderOptions): Promise<string[]>             { return readFolderNames(opts); }
  readFileEntries(opts: ReadFolderOptions): Promise<FolderEntry[]>        { return readFileEntries(opts); }
  readSubfolderEntries(opts: ReadFolderOptions): Promise<FolderEntry[]>   { return readSubfolderEntries(opts); }
  createFolder(opts: CreateFolderOptions): Promise<CreateFolderResult>    { return createFolder(opts); }
  createFolders(sandboxRoot: string, paths: string[]): Promise<CreateFolderResult[]> { return createFolders(sandboxRoot, paths); }
}

export const folderToolService = new FolderToolService();
