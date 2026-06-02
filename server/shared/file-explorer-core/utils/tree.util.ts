/**
 * server/file-explorer/utils/tree.util.ts
 * Pure utilities for traversing and summarising RawTreeNode trees. No fs access.
 */

import type { RawTreeNode, TreeStats } from '../types/index.ts';

/** Recursively counts files and folders in a tree. */
export function countNodes(tree: RawTreeNode[]): TreeStats {
  let files = 0, folders = 0;
  function walk(nodes: RawTreeNode[]) {
    for (const n of nodes) {
      if (n.type === 'file') { files++; }
      else { folders++; if (n.children) walk(n.children); }
    }
  }
  walk(tree);
  return { files, folders, total: files + folders };
}

/** Flattens a tree to a list of relative paths (files only). */
export function flattenFilePaths(tree: RawTreeNode[], prefix = ''): string[] {
  const paths: string[] = [];
  for (const n of tree) {
    const full = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.type === 'file') { paths.push(full); }
    else if (n.children) { paths.push(...flattenFilePaths(n.children, full)); }
  }
  return paths;
}

/** Finds all folder paths that must be expanded to make the given file path visible. */
export function expandPathsFor(filePath: string): string[] {
  const parts  = filePath.split('/');
  const result: string[] = [];
  let current = '';
  for (let i = 0; i < parts.length - 1; i++) {
    current = current ? `${current}/${parts[i]}` : parts[i];
    result.push(current);
  }
  return result;
}

/** Sorts tree nodes: folders first, then alphabetically by name. */
export function sortNodes(nodes: RawTreeNode[]): RawTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
