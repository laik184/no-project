/**
 * server/tools/filesystem/services/structure.service.ts
 *
 * Service layer for ASCII tree and folder-structure operations on the agent sandbox.
 * Tool → StructureService → lib/folders/folder-structure (repository/infra layer)
 *
 * No tool may import lib/folders/folder-structure.ts directly.
 */

import {
  getAsciiTree,
  getFolderStructure,
  type FolderStructureOptions,
  type TreeNode,
} from '../lib/folders/folder-structure.ts';

export type { FolderStructureOptions, TreeNode };

class StructureService {
  asciiTree(opts: FolderStructureOptions): Promise<string> {
    return getAsciiTree(opts);
  }

  folderStructure(opts: FolderStructureOptions): Promise<TreeNode[]> {
    return getFolderStructure(opts);
  }
}

export const structureToolService = new StructureService();
