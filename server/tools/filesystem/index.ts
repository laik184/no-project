/**
 * server/tools/filesystem/index.ts
 *
 * Public surface of the centralized filesystem tool system.
 *
 * Replaces the placeholder stub that was previously here.
 * Import tools through this barrel for clean dependency graphs.
 *
 * Usage:
 *   import { registerFilesystemTools } from '../../tools/filesystem/index.ts';
 *   registerFilesystemTools(); // call at app boot
 */

// ── Registration ──────────────────────────────────────────────────────────────
export {
  registerFilesystemTools,
  FILESYSTEM_TOOL_COUNT,
  FILESYSTEM_TOOL_NAMES,
} from './registry/register-filesystem-tools.ts';

// ── Shared utilities ──────────────────────────────────────────────────────────
export { classifyFsError }                from './shared/filesystem-errors.ts';
export { fsCtx, fsSandboxRoot }           from './shared/filesystem-context.ts';
export { normalizePath, stripAbsolutePaths } from './shared/filesystem-result.ts';
export {
  validateStringInput,
  validatePathInput,
  validateLineNumber,
  assertInputString,
  assertInputPath,
} from './validation/operation-validator.ts';

// ── Validation re-exports ─────────────────────────────────────────────────────
export {
  validatePath, validateRelativePath, validateFilename,
  assertPath, assertRelativePath, assertFilename,
  PathValidationError,
} from './validation/path-validator.ts';
export {
  validateSandboxPath, assertSandboxPath,
  resolveSandboxPath, isInsideSandbox,
  SandboxViolationError,
} from './validation/sandbox-validator.ts';
export {
  assertReadOperation, assertWriteOperation, assertDeleteOperation,
  FileValidationError,
} from './validation/file-validator.ts';

// ── Individual tool definitions (for introspection / testing) ─────────────────
export { readFileTool }     from './read/read-file.ts';
export { readLinesTool }    from './read/read-lines.ts';
export { readFolderTool }   from './read/read-folder.ts';
export { fileMetadataTool } from './read/file-metadata.ts';

export { writeFileTool }     from './write/write-file.ts';
export { appendFileTool }    from './write/append-file.ts';
export { ensureFileTool }    from './write/ensure-file.ts';
export { writeIfAbsentTool } from './write/write-if-absent.ts';

export { patchFileTool }   from './edit/patch-file.ts';
export { patchAllTool }    from './edit/patch-all.ts';
export { replaceLineTool } from './edit/replace-line.ts';
export { insertAtTool }    from './edit/insert-at.ts';
export { replaceAllTool }  from './edit/replace-all.ts';

export { deleteFileTool }     from './delete/delete-file.ts';
export { deleteFolderTool }   from './delete/delete-folder.ts';
export { deleteMultipleTool } from './delete/delete-multiple.ts';

export { moveFileTool }     from './move/move-file.ts';
export { moveFolderTool }   from './move/move-folder.ts';
export { renameFileTool }   from './move/rename-file.ts';
export { renameFolderTool } from './move/rename-folder.ts';

export { cloneFileTool }   from './clone/clone-file.ts';
export { cloneFolderTool } from './clone/clone-folder.ts';

export { findByNameTool }       from './search/find-by-name.ts';
export { findByExtensionTool }  from './search/find-by-extension.ts';
export { findByPatternTool }    from './search/find-by-pattern.ts';
export { searchTextTool }       from './search/search-text.ts';
export { searchRegexTool }      from './search/search-regex.ts';
export { findImportsTool }      from './search/find-imports.ts';
export { findExportsTool }      from './search/find-exports.ts';
export { findSymbolUsagesTool } from './search/find-symbol-usages.ts';

export { scanFolderTool }      from './structure/scan-folder.ts';
export { folderStructureTool } from './structure/folder-structure.ts';
export { asciiTreeTool }       from './structure/ascii-tree.ts';
export { scanExtensionTool }   from './structure/scan-extension.ts';

export { createFolderTool }     from './folders/create-folder.ts';
export { createFoldersTool }    from './folders/create-folders.ts';
export { folderEntriesTool }    from './folders/folder-entries.ts';
export { folderNamesTool }      from './folders/folder-names.ts';
export { subfolderEntriesTool } from './folders/subfolder-entries.ts';
export { fileEntriesTool }      from './folders/file-entries.ts';

// ── Tool services (agent-facing service layer) ────────────────────────────────
export { cloneToolService }     from './clone/tool.service.ts';
export { deleteToolService }    from './delete/tool.service.ts';
export { folderToolService }    from './folder/tool.service.ts';
export { moveToolService }      from './move/tool.service.ts';
export { readToolService }      from './read/tool.service.ts';
export { searchToolService }    from './search/tool.service.ts';
export { structureToolService } from './structure/tool.service.ts';
export { writeToolService }     from './write/tool.service.ts';
