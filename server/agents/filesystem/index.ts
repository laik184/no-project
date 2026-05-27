// files
export { readFile, readLines, fileExistsInSandbox, getFileMetadata, getFileSize } from './files/file-reader.ts';
export { writeFile, writeFileIfAbsent, ensureFile } from './files/file-writer.ts';
export { appendToFile, replaceLine, insertAt, replaceAll } from './files/file-editor.ts';
export { renameFile } from './files/file-renamer.ts';
export { moveFile } from './files/file-mover.ts';
export { deleteFileFromSandbox, deleteMultipleFiles } from './files/file-deleter.ts';
export { cloneFile } from './files/file-cloner.ts';
export { patchFile, patchFileAll } from './files/patch-file.ts';

// folders
export { createFolder, createFolders } from './folders/folder-creator.ts';
export { readFolder, readFolderNames, readFileEntries, readSubfolderEntries } from './folders/folder-reader.ts';
export { renameFolder } from './folders/folder-renamer.ts';
export { moveFolder } from './folders/folder-mover.ts';
export { deleteFolder } from './folders/folder-deleter.ts';
export { cloneFolder } from './folders/folder-cloner.ts';
export { scanFolder, scanFilesByExtension } from './folders/folder-scanner.ts';
export { getFolderStructure, getAsciiTree, renderAsciiTree } from './folders/folder-structure.ts';

// search
export { findByName, findByExtension, findByPattern, listFilesInDir } from './search/file-search.ts';
export { searchText, formatTextSearchResults } from './search/text-search.ts';
export { searchRegex, formatRegexResults } from './search/regex-search.ts';
export { findImports, findExports, findSymbolUsages } from './search/dependency-search.ts';

// structure
export { buildStructure } from './structure/structure-builder.ts';
export { readStructure, readStructureAsJSON } from './structure/structure-reader.ts';
export { validateStructure } from './structure/structure-validator.ts';
export { patchStructure } from './structure/structure-patcher.ts';
export { generateScaffold, getAvailableTemplates } from './structure/scaffold-generator.ts';

// workspace
export { workspaceManager, WorkspaceManager } from './workspace/workspace-manager.ts';
export { isolationManager, IsolationManager } from './workspace/isolation-manager.ts';
export { snapshotManager, SnapshotManager } from './workspace/snapshot-manager.ts';
export { workspaceHistory, WorkspaceHistory } from './workspace/workspace-history.ts';

// permissions
export { canWrite, canDelete, canRead, isProtectedPath, DEFAULT_POLICY } from './permissions/access-policy.ts';
export { guardWrite, guardDelete, guardMove, guardRename, guardBulkDelete } from './permissions/operation-guard.ts';
export { validateShellCommand, isCommandSafe, getAllowedCommands } from './permissions/command-safety.ts';
export { permissionManager, PermissionManager } from './permissions/permission-manager.ts';

// validation
export { validatePath, assertPath, validateRelativePath, assertRelativePath, validateFilename } from './validation/path-validator.ts';
export { validateSandboxPath, assertSandboxPath, isInsideSandbox } from './validation/sandbox-validator.ts';
export { validateFileContent, assertFileContent, validateFileSize, validateLineRange } from './validation/integrity-validator.ts';
export { validateReadOperation, validateWriteOperation, validateDeleteOperation } from './validation/file-validator.ts';
export { validateReplacement, assertReplacement, validateSingleReplacement } from './validation/replacement-validator.ts';

// utils
export { joinPath, normalizePath, basename, dirname, extname, isAbsolutePath, resolvePath, relativePath, changeExt, splitPath } from './utils/path-utils.ts';
export { lineDiff, formatDiff, diffStats, hasDiff, diffSummary } from './utils/diff-utils.ts';
export { hasTraversal, hasNullByte, detectEscapeAttempt, sanitizePath, isAbsoluteSystemPath } from './utils/traversal-utils.ts';
export { fileExists, isFile, isDirectory, getFileStat, ensureDir, readTextFile, writeTextFile, deleteFile, deleteDir, copyFile, moveFile as moveFileRaw, listDir, copyDir } from './utils/filesystem-utils.ts';

// types
export type { FileStat } from './utils/filesystem-utils.ts';
export type { DiffLine, DiffResult } from './utils/diff-utils.ts';
export type { ScanEntry, ScanResult } from './folders/folder-scanner.ts';
export type { FolderEntry } from './folders/folder-reader.ts';
export type { TreeNode } from './folders/folder-structure.ts';
export type { StructureSpec, FolderSpec, FileSpec, BuildResult } from './structure/structure-builder.ts';
export type { StructurePatchOp, StructurePatchResult } from './structure/structure-patcher.ts';
export type { WorkspaceInfo } from './workspace/workspace-manager.ts';
export type { IsolationContext } from './workspace/isolation-manager.ts';
export type { HistoryEntry, OperationType } from './workspace/workspace-history.ts';
export type { ProjectTemplate } from './structure/scaffold-generator.ts';
