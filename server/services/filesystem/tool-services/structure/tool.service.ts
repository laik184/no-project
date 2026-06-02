/**
 * server/file-explorer/services/structure/structure.service.ts
 *
 * Tool-facing service for ASCII tree and folder-structure operations.
 * Tool → structureToolService → lib/folders/folder-structure (infra layer)
 */

import {
  getAsciiTree,
  getFolderStructure,
  type FolderStructureOptions,
  type TreeNode,
} from '../../../../tools/filesystem/lib/folders/folder-structure.ts';

export type { FolderStructureOptions, TreeNode };

class StructureToolService {
  asciiTree(opts: FolderStructureOptions): Promise<string>      { return getAsciiTree(opts); }
  folderStructure(opts: FolderStructureOptions): Promise<TreeNode[]> { return getFolderStructure(opts); }
}

export const structureToolService = new StructureToolService();
