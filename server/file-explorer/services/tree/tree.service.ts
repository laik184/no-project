/**
 * server/file-explorer/services/tree/tree.service.ts
 * Builds the file tree for a given project path.
 */

import path from 'path';
import { FE_CONFIG }          from '../../config/index.ts';
import { resolveSafe }        from '../../guards/index.ts';
import { buildTreeFromDir }   from '../../mappers/index.ts';
import { countNodes }         from '../../utils/index.ts';
import type { TreeResponse }  from '../../contracts/index.ts';
import type { RawTreeNode }   from '../../types/index.ts';

class TreeService {

  /**
   * Returns the full directory tree for the sandbox (or a sub-path).
   * Applies exclude patterns and showHidden from config.
   */
  getTree(projectPath?: string): TreeResponse {
    try {
      const root = projectPath
        ? resolveSafe(projectPath)
        : FE_CONFIG.sandboxRoot;

      const tree: RawTreeNode[] = buildTreeFromDir(root, FE_CONFIG.sandboxRoot, {
        showHidden:      FE_CONFIG.showHidden,
        excludePatterns: FE_CONFIG.excludePatterns,
      });

      return { ok: true, tree };
    } catch (err) {
      return { ok: false, tree: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Returns tree stats (file count, folder count) without building the full tree.
   */
  getStats(projectPath?: string): { ok: boolean; files: number; folders: number; error?: string } {
    const result = this.getTree(projectPath);
    if (!result.ok) return { ok: false, files: 0, folders: 0, error: result.error };
    const stats  = countNodes(result.tree);
    return { ok: true, ...stats };
  }
}

export const treeService = new TreeService();
