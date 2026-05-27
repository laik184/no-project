/**
 * server/tools/filesystem/shared/filesystem-types.ts
 *
 * Shared input/output types used across all filesystem tool handlers.
 * Re-exports key types from existing agents to avoid duplication.
 */

export type { FileStat }      from '../../../agents/filesystem/utils/filesystem-utils.ts';
export type { FolderEntry }   from '../../../agents/filesystem/folders/folder-reader.ts';
export type { ScanEntry, ScanResult, ScanOptions } from '../../../agents/filesystem/folders/folder-scanner.ts';
export type { TreeNode }      from '../../../agents/filesystem/folders/folder-structure.ts';
export type { WriteResult }   from '../../../agents/filesystem/files/file-writer.ts';
export type { PatchResult }   from '../../../agents/filesystem/files/patch-file.ts';
export type { DeleteResult }  from '../../../agents/filesystem/files/file-deleter.ts';
export type { MoveResult }    from '../../../agents/filesystem/files/file-mover.ts';
export type { CloneResult }   from '../../../agents/filesystem/files/file-cloner.ts';
export type { RenameResult }  from '../../../agents/filesystem/files/file-renamer.ts';
export type { DeleteFolderResult }   from '../../../agents/filesystem/folders/folder-deleter.ts';
export type { MoveFolderResult }     from '../../../agents/filesystem/folders/folder-mover.ts';
export type { CloneFolderResult }    from '../../../agents/filesystem/folders/folder-cloner.ts';
export type { RenameFolderResult }   from '../../../agents/filesystem/folders/folder-renamer.ts';
export type { CreateFolderResult }   from '../../../agents/filesystem/folders/folder-creator.ts';
export type { TextSearchResult, TextMatch } from '../../../agents/filesystem/search/text-search.ts';
export type { RegexSearchResult, RegexMatch } from '../../../agents/filesystem/search/regex-search.ts';
export type { FileSearchResult }     from '../../../agents/filesystem/search/file-search.ts';
export type { ImportEntry, ExportEntry, UsageEntry } from '../../../agents/filesystem/search/dependency-search.ts';
export type { FileMetadata }         from '../../../agents/filesystem/files/file-reader.ts';
