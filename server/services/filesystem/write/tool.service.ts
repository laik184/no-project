/**
 * server/services/filesystem/write/tool.service.ts
 *
 * Tool-facing service for agent sandbox write/edit/patch operations.
 * Tool → writeToolService → lib/files/{file-writer,file-editor,patch-file} (infra layer)
 */

import {
  writeFile, writeFileIfAbsent, ensureFile,
  type WriteOptions, type WriteResult,
} from '../../../tools/filesystem/lib/files/file-writer.ts';

import {
  appendToFile, replaceLine, insertAt, replaceAll,
  type AppendOptions, type ReplaceLineOptions,
  type InsertAtOptions, type ReplaceAllOptions,
} from '../../../tools/filesystem/lib/files/file-editor.ts';

import {
  patchFile, patchFileAll,
  type PatchOptions, type PatchResult,
} from '../../../tools/filesystem/lib/files/patch-file.ts';

export type {
  WriteOptions, WriteResult,
  AppendOptions, ReplaceLineOptions, InsertAtOptions, ReplaceAllOptions,
  PatchOptions, PatchResult,
};

class WriteToolService {
  write(opts: WriteOptions): Promise<WriteResult>                              { return writeFile(opts); }
  writeIfAbsent(opts: Omit<WriteOptions,'overwrite'>): Promise<WriteResult>   { return writeFileIfAbsent(opts); }
  ensure(opts: WriteOptions): Promise<WriteResult>                             { return ensureFile(opts); }
  append(opts: AppendOptions): Promise<void>                                   { return appendToFile(opts); }
  replaceLine(opts: ReplaceLineOptions): Promise<void>                         { return replaceLine(opts); }
  insertAt(opts: InsertAtOptions): Promise<void>                               { return insertAt(opts); }
  replaceAll(opts: ReplaceAllOptions): Promise<number>                         { return replaceAll(opts); }
  patch(opts: PatchOptions): Promise<PatchResult>                              { return patchFile(opts); }
  patchAll(opts: PatchOptions): Promise<PatchResult>                           { return patchFileAll(opts); }
}

export const writeToolService = new WriteToolService();
