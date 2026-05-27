import { scanFolder, type ScanEntry } from '../folders/folder-scanner.ts';
import { getAsciiTree } from '../folders/folder-structure.ts';
import { assertRelativePath } from '../validation/path-validator.ts';

export interface StructureNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  depth: number;
  extension?: string;
  children: StructureNode[];
}

export interface StructureReadOptions {
  sandboxRoot: string;
  path: string;
  maxDepth?: number;
  includeHidden?: boolean;
}

export interface StructureReport {
  root: string;
  tree: StructureNode[];
  asciiTree: string;
  totalFiles: number;
  totalDirs: number;
  totalSize: number;
}

function buildNodes(entries: ScanEntry[], depth: number): StructureNode[] {
  return entries
    .filter(e => e.depth === depth)
    .map(entry => ({
      name: entry.name,
      path: entry.relativePath,
      type: (entry.isFile ? 'file' : 'directory') as 'file' | 'directory',
      size: entry.size,
      depth: entry.depth,
      extension: entry.extension || undefined,
      children: entry.isDirectory ? buildNodes(entries, depth + 1).filter(
        c => c.path.startsWith(entry.relativePath + '/')
      ) : [],
    }));
}

export async function readStructure(opts: StructureReadOptions): Promise<StructureReport> {
  assertRelativePath(opts.path);

  const scan = await scanFolder({
    sandboxRoot: opts.sandboxRoot,
    path: opts.path,
    maxDepth: opts.maxDepth,
    includeHidden: opts.includeHidden,
  });

  const tree = buildNodes(scan.entries, 1);
  const asciiTree = await getAsciiTree({
    sandboxRoot: opts.sandboxRoot,
    path: opts.path,
    maxDepth: opts.maxDepth,
    includeHidden: opts.includeHidden,
  });

  return {
    root: opts.path,
    tree,
    asciiTree,
    totalFiles: scan.totalFiles,
    totalDirs: scan.totalDirs,
    totalSize: scan.totalSize,
  };
}

export async function readStructureAsJSON(opts: StructureReadOptions): Promise<string> {
  const report = await readStructure(opts);
  return JSON.stringify({ root: report.root, tree: report.tree }, null, 2);
}
