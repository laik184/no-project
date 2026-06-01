/**
 * server/file-explorer/types/tree.types.ts
 * Tree node types — aligned exactly with the frontend RawTreeNode contract.
 */

import type { FileKind } from './file.types.ts';

/**
 * A single node in the file tree.
 * Shape MUST match frontend RawTreeNode — type is 'file' | 'folder', NOT isDirectory.
 */
export interface RawTreeNode {
  readonly name:      string;
  readonly type:      FileKind;
  readonly children?: RawTreeNode[];
  readonly size?:     number;   // bytes; files only
  readonly mtime?:    number;   // ms since epoch; files only
}

/** Options controlling how the tree is built. */
export interface TreeBuildOptions {
  readonly showHidden:      boolean;
  readonly excludePatterns: readonly string[];
  readonly maxDepth?:       number;
}

/** Summary counts over a tree. */
export interface TreeStats {
  readonly files:   number;
  readonly folders: number;
  readonly total:   number;
}
