/**
 * server/tools/filesystem/registry/register-filesystem-tools.ts
 *
 * Single entry-point that registers ALL filesystem tools with the
 * central tool registry.  Call this once at application boot,
 * before sealRegistry().
 *
 * Tools are imported directly — no dynamic require() needed.
 */

import { registerTool } from '../../../tools/registry/tool-registry.ts';

// ── Read ──────────────────────────────────────────────────────────────────────
import { readFileTool }     from '../read/read-file.ts';
import { readLinesTool }    from '../read/read-lines.ts';
import { readFolderTool }   from '../read/read-folder.ts';
import { fileMetadataTool } from '../read/file-metadata.ts';

// ── Write ─────────────────────────────────────────────────────────────────────
import { writeFileTool }     from '../write/write-file.ts';
import { appendFileTool }    from '../write/append-file.ts';
import { ensureFileTool }    from '../write/ensure-file.ts';
import { writeIfAbsentTool } from '../write/write-if-absent.ts';

// ── Edit ──────────────────────────────────────────────────────────────────────
import { patchFileTool }   from '../edit/patch-file.ts';
import { patchAllTool }    from '../edit/patch-all.ts';
import { replaceLineTool } from '../edit/replace-line.ts';
import { insertAtTool }    from '../edit/insert-at.ts';
import { replaceAllTool }  from '../edit/replace-all.ts';

// ── Delete ────────────────────────────────────────────────────────────────────
import { deleteFileTool }     from '../delete/delete-file.ts';
import { deleteFolderTool }   from '../delete/delete-folder.ts';
import { deleteMultipleTool } from '../delete/delete-multiple.ts';

// ── Move / Rename ─────────────────────────────────────────────────────────────
import { moveFileTool }     from '../move/move-file.ts';
import { moveFolderTool }   from '../move/move-folder.ts';
import { renameFileTool }   from '../move/rename-file.ts';
import { renameFolderTool } from '../move/rename-folder.ts';

// ── Clone ─────────────────────────────────────────────────────────────────────
import { cloneFileTool }   from '../clone/clone-file.ts';
import { cloneFolderTool } from '../clone/clone-folder.ts';

// ── Search ────────────────────────────────────────────────────────────────────
import { findByNameTool }        from '../search/find-by-name.ts';
import { findByExtensionTool }   from '../search/find-by-extension.ts';
import { findByPatternTool }     from '../search/find-by-pattern.ts';
import { searchTextTool }        from '../search/search-text.ts';
import { searchRegexTool }       from '../search/search-regex.ts';
import { findImportsTool }       from '../search/find-imports.ts';
import { findExportsTool }       from '../search/find-exports.ts';
import { findSymbolUsagesTool }  from '../search/find-symbol-usages.ts';

// ── Structure ─────────────────────────────────────────────────────────────────
import { scanFolderTool }      from '../structure/scan-folder.ts';
import { folderStructureTool } from '../structure/folder-structure.ts';
import { asciiTreeTool }       from '../structure/ascii-tree.ts';
import { scanExtensionTool }   from '../structure/scan-extension.ts';

// ── Folders ───────────────────────────────────────────────────────────────────
import { createFolderTool }     from '../folders/create-folder.ts';
import { createFoldersTool }    from '../folders/create-folders.ts';
import { folderEntriesTool }    from '../folders/folder-entries.ts';
import { folderNamesTool }      from '../folders/folder-names.ts';
import { subfolderEntriesTool } from '../folders/subfolder-entries.ts';
import { fileEntriesTool }      from '../folders/file-entries.ts';

// ── All tools in registration order ───────────────────────────────────────────

const ALL_FILESYSTEM_TOOLS = [
  // Read
  readFileTool, readLinesTool, readFolderTool, fileMetadataTool,
  // Write
  writeFileTool, appendFileTool, ensureFileTool, writeIfAbsentTool,
  // Edit
  patchFileTool, patchAllTool, replaceLineTool, insertAtTool, replaceAllTool,
  // Delete
  deleteFileTool, deleteFolderTool, deleteMultipleTool,
  // Move
  moveFileTool, moveFolderTool, renameFileTool, renameFolderTool,
  // Clone
  cloneFileTool, cloneFolderTool,
  // Search
  findByNameTool, findByExtensionTool, findByPatternTool,
  searchTextTool, searchRegexTool,
  findImportsTool, findExportsTool, findSymbolUsagesTool,
  // Structure
  scanFolderTool, folderStructureTool, asciiTreeTool, scanExtensionTool,
  // Folders
  createFolderTool, createFoldersTool, folderEntriesTool,
  folderNamesTool, subfolderEntriesTool, fileEntriesTool,
] as const;

let _registered = false;

/**
 * Register all filesystem tools.
 * Idempotent — safe to call multiple times (subsequent calls are no-ops).
 */
export function registerFilesystemTools(): void {
  if (_registered) return;

  for (const tool of ALL_FILESYSTEM_TOOLS) {
    registerTool(tool, { force: false });
  }

  _registered = true;
}

export const FILESYSTEM_TOOL_COUNT = ALL_FILESYSTEM_TOOLS.length;
export const FILESYSTEM_TOOL_NAMES = ALL_FILESYSTEM_TOOLS.map(t => t.name);
