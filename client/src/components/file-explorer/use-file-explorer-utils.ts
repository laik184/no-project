import { RawTreeNode } from "./types";

export function countTree(tree: RawTreeNode[]): { files: number; folders: number } {
  let files = 0, folders = 0;
  function walk(nodes: RawTreeNode[]) {
    for (const n of nodes) {
      if (n.type === "file") files++;
      else { folders++; if (n.children) walk(n.children); }
    }
  }
  walk(tree);
  return { files, folders };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)             return `${bytes}B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
