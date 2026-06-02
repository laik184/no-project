/**
 * server/tools/filesystem/shared/filesystem-types.ts
 *
 * Shared input/output types used across all filesystem tool handlers.
 * Re-exports key types from existing agents to avoid duplication.
 */

export type { FileStat }      from '../lib/utils/filesystem-utils.ts';
export type { FolderEntry }   from '../lib/folders/folder-reader.ts';
export type { ScanEntry, ScanResult, ScanWithFiltersOptions } from '../../../services/filesystem/scanner/index.ts';
export type { TreeNode }      from '../lib/folders/folder-structure.ts';
export type { WriteResult }   from '../lib/files/file-writer.ts';
export type { PatchResult }   from '../lib/files/patch-file.ts';
export type { DeleteResult }  from '../lib/files/file-deleter.ts';
export type { MoveResult }    from '../lib/files/file-mover.ts';
export type { CloneResult }   from '../lib/files/file-cloner.ts';
export type { RenameResult }  from '../lib/files/file-renamer.ts';
export type { DeleteFolderResult }   from '../lib/folders/folder-deleter.ts';
export type { MoveFolderResult }     from '../lib/folders/folder-mover.ts';
export type { CloneFolderResult }    from '../lib/folders/folder-cloner.ts';
export type { RenameFolderResult }   from '../lib/folders/folder-renamer.ts';
export type { CreateFolderResult }   from '../lib/folders/folder-creator.ts';
export type { TextSearchResult, TextMatch } from '../lib/search/text-search.ts';
export type { RegexSearchResult, RegexMatch } from '../lib/search/regex-search.ts';
export type { FileSearchResult }     from '../lib/search/file-search.ts';
export type { ImportEntry, ExportEntry, UsageEntry } from '../../../services/filesystem/dependency-analysis/index.ts';
export type { FileMetadata }         from '../lib/files/file-reader.ts';
