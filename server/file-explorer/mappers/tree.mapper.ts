/**
 * server/file-explorer/mappers/tree.mapper.ts
 * Converts raw filesystem entries into the RawTreeNode contract the frontend expects.
 * Routes through treeService — no direct repository access.
 */

import { treeService }      from '../../services/filesystem/index.ts';
import type { RawTreeNode } from '../types/index.ts';

export function buildTreeFromDir(projectPath?: string): RawTreeNode[] {
  const result = treeService.getTree(projectPath);
  return result.ok ? result.tree : [];
}
