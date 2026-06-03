/**
 * server/file-explorer/mappers/tree.mapper.ts
 * Converts raw filesystem entries into the RawTreeNode contract the frontend expects.
 * type: 'file' | 'folder' — NOT isDirectory boolean (legacy FileItem shape).
 */

import path from 'path';
import type { RawTreeNode, TreeBuildOptions } from '../types/index.ts';
import { filesystemRepository } from '../../repositories/file-system/index.ts';
import { isExcluded }           from '../guards/index.ts';
import { sortNodes }             from '../utils/index.ts';

/**
 * Recursively builds a RawTreeNode tree from absDir.
 * Only this mapper + filesystem.repository may call readdirSync.
 */
export function buildTreeFromDir(
  absDir:      string,
  sandboxRoot: string,
  opts:        TreeBuildOptions,
  depth = 0,
): RawTreeNode[] {
  if (!filesystemRepository.exists(absDir)) return [];
  if (opts.maxDepth !== undefined && depth > opts.maxDepth) return [];

  const entries = filesystemRepository.readDir(absDir, sandboxRoot);
  const nodes: RawTreeNode[] = [];

  for (const e of entries) {
    if (isExcluded(e.name, opts.excludePatterns)) continue;
    if (!opts.showHidden && e.name.startsWith('.')) continue;

    if (e.kind === 'folder') {
      const children = buildTreeFromDir(
        path.join(absDir, e.name), sandboxRoot, opts, depth + 1,
      );
      nodes.push({ name: e.name, type: 'folder', children });
    } else {
      nodes.push({ name: e.name, type: 'file', size: e.size, mtime: e.mtime });
    }
  }

  return sortNodes(nodes);
}
