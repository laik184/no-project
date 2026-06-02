/**
 * server/file-explorer/services/move/move.service.ts
 *
 * Tool-facing service for agent sandbox move/rename operations.
 * Tool → moveToolService → lib/files/{file-mover,file-renamer} + lib/folders/{folder-mover,folder-renamer}
 */

import {
  moveFile,
  type MoveOptions,
  type MoveResult,
} from '../../../../tools/filesystem/lib/files/file-mover.ts';

import {
  renameFile,
  type RenameOptions,
  type RenameResult,
} from '../../../../tools/filesystem/lib/files/file-renamer.ts';

import {
  moveFolder,
  type MoveFolderOptions,
  type MoveFolderResult,
} from '../../../../tools/filesystem/lib/folders/folder-mover.ts';

import {
  renameFolder,
  type RenameFolderOptions,
  type RenameFolderResult,
} from '../../../../tools/filesystem/lib/folders/folder-renamer.ts';

export type {
  MoveOptions, MoveResult,
  RenameOptions, RenameResult,
  MoveFolderOptions, MoveFolderResult,
  RenameFolderOptions, RenameFolderResult,
};

class MoveToolService {
  moveFile(opts: MoveOptions): Promise<MoveResult>                   { return moveFile(opts); }
  renameFile(opts: RenameOptions): Promise<RenameResult>             { return renameFile(opts); }
  moveFolder(opts: MoveFolderOptions): Promise<MoveFolderResult>     { return moveFolder(opts); }
  renameFolder(opts: RenameFolderOptions): Promise<RenameFolderResult> { return renameFolder(opts); }
}

export const moveToolService = new MoveToolService();
